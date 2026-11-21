using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Sacou.Modules.Notifications.Contracts;
using Sacou.Modules.Sessions.Infrastructure;
using Sacou.Modules.Sessions.Infrastructure.Outbox;

namespace Sacou.Modules.Sessions.Application.Outbox;

/// <summary>What one run of the relay took from the outbox, and how many of those failed and wait for another run.</summary>
internal sealed record RelayRun(int Taken, int Failed);

/// <summary>
/// The relay (ADR 0069, D3): in one transaction, takes the messages still in line with <c>FOR UPDATE SKIP LOCKED</c> (two
/// relays never take the same), asks the Notifications for each, and marks them processed. A crash between the ask and
/// the mark runs the ask again later, and the dedupe key makes that create nothing new.
/// </summary>
/// <remarks>
/// Each message is asked on its own: the Notifications writes on its own connection, so one that fails leaves the
/// others, and this transaction, untouched. A failure counts one attempt and leaves the message for the next run; after
/// <see cref="MaxAttempts"/> failures, or out of shape, it is set aside (<c>set_aside_at</c>, never <c>processed_at</c>),
/// with one structured log for the alert, so a poison message never blocks the line. A run cut by its caller's budget
/// throws and rolls back: no attempt is counted, because the message did not fail (ADR 0069, D3).
/// </remarks>
internal sealed partial class SessionsOutboxRelay(
    SessionsDbContext database, INotificationRequests requests, TimeProvider time, ILogger<SessionsOutboxRelay> logger)
{
    public const int BatchSize = 50;

    /// <summary>Failed tries before a message is set aside: one per drain, so a passing outage over a few writes is survived.</summary>
    public const int MaxAttempts = 5;

    /// <summary>The reasons of a message set aside, in its log: a closed list, for the log-based metric.</summary>
    public const string PayloadInvalidReason = "payload-invalid";
    public const string MaxAttemptsReason = "max-attempts";

    /// <summary>Relays one batch.</summary>
    public async Task<RelayRun> RunAsync(CancellationToken cancellationToken)
    {
        var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            var messages = await database.OutboxMessages
                .FromSql(
                    $"""
                    SELECT * FROM sessions.outbox_messages WHERE processed_at IS NULL AND set_aside_at IS NULL
                    ORDER BY occurred_at, id LIMIT {BatchSize} FOR UPDATE SKIP LOCKED
                    """)
                .AsNoTracking().ToListAsync(cancellationToken).ConfigureAwait(false);
            var outcomes = new List<(OutboxMessageRow Message, RelayOutcome Outcome)>();
            foreach (var message in messages)
            {
                outcomes.Add((message, await TryRelayAsync(message, cancellationToken).ConfigureAwait(false)));
            }

            await RecordAsync(outcomes, time.GetUtcNow(), cancellationToken).ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            return new RelayRun(messages.Count, outcomes.Count(entry => entry.Outcome != RelayOutcome.Relayed));
        }
    }

    private async Task RecordAsync(List<(OutboxMessageRow Message, RelayOutcome Outcome)> outcomes, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var relayed = outcomes.Where(entry => entry.Outcome == RelayOutcome.Relayed).Select(entry => entry.Message.Id).ToList();
        var failed = outcomes.Where(entry => entry.Outcome == RelayOutcome.Failed).Select(entry => entry.Message).ToList();
        var spent = failed.Where(message => message.Attempts + 1 >= MaxAttempts).ToList();
        var invalid = outcomes.Where(entry => entry.Outcome == RelayOutcome.PayloadInvalid).Select(entry => entry.Message).ToList();
        spent.ForEach(message => SetAside(logger, message.Id, MaxAttemptsReason, message.Attempts + 1));
        invalid.ForEach(message => SetAside(logger, message.Id, PayloadInvalidReason, message.Attempts + 1));
        var retried = failed.Except(spent).Select(message => message.Id).ToList();
        List<Guid> setAside = [.. spent.Select(message => message.Id), .. invalid.Select(message => message.Id)];
        await CountAttemptAsync(relayed, processedAt: now, setAsideAt: null, cancellationToken).ConfigureAwait(false);
        await CountAttemptAsync(setAside, processedAt: null, setAsideAt: now, cancellationToken).ConfigureAwait(false);
        await CountAttemptAsync(retried, processedAt: null, setAsideAt: null, cancellationToken).ConfigureAwait(false);
    }

    private async Task<RelayOutcome> TryRelayAsync(OutboxMessageRow message, CancellationToken cancellationToken)
    {
        if (OutboxPayload.Read(message.Payload) is not { } payload)
        {
            // Never written by this code: set aside so it never blocks the line, and logged by its id only.
            return RelayOutcome.PayloadInvalid;
        }

        try
        {
            await requests.RequestAsync(
                new NotificationRequest(message.DedupeKey, NotificationRequestKind.WaitlistPromoted, payload.MemberId, payload.GroupId, payload.RoundId, payload.StartsAt),
                cancellationToken).ConfigureAwait(false);
            return RelayOutcome.Relayed;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // The caller's budget, not the message: rolled back, no attempt counted.
            throw;
        }
#pragma warning disable CA1031 // One message's failure, whatever it is, must leave the others going: counted and tried again (ADR 0069, D3).
        catch (Exception exception)
#pragma warning restore CA1031
        {
            RelayFailed(logger, message.Id, exception.GetType().Name);
            return RelayOutcome.Failed;
        }
    }

    /// <summary>One more attempt on each message; a non-null end takes them out of the line.</summary>
    private async Task CountAttemptAsync(List<Guid> ids, DateTimeOffset? processedAt, DateTimeOffset? setAsideAt, CancellationToken cancellationToken)
    {
        if (ids.Count == 0)
        {
            return;
        }

        _ = await database.OutboxMessages.Where(message => ids.Contains(message.Id))
            .ExecuteUpdateAsync(
                update => update.SetProperty(message => message.ProcessedAt, processedAt)
                    .SetProperty(message => message.SetAsideAt, setAsideAt)
                    .SetProperty(message => message.Attempts, message => message.Attempts + 1),
                cancellationToken)
            .ConfigureAwait(false);
    }

    private enum RelayOutcome
    {
        Relayed,
        Failed,
        PayloadInvalid,
    }

    /// <summary>The reason is the exception's type, never its message (it may quote a value).</summary>
    [LoggerMessage(Level = LogLevel.Warning, Message = "Outbox message {MessageId} was not relayed: {Reason}; tried again on the next run.")]
    private static partial void RelayFailed(ILogger logger, Guid messageId, string reason);

    /// <summary>
    /// The one log of a message set aside, with a stable event name for the Cloud Logging metric and alert (ADR 0069, D3):
    /// its id, a reason from a closed list and the attempts. Nothing else.
    /// </summary>
    [LoggerMessage(EventId = 6901, EventName = "OutboxMessageSetAside", Level = LogLevel.Error,
        Message = "Outbox message {MessageId} set aside: {SetAsideReason} after {Attempts} attempts.")]
    private static partial void SetAside(ILogger logger, Guid messageId, string setAsideReason, int attempts);
}
