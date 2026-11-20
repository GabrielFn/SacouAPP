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
/// The relay (ADR 0069, D3): in one transaction, takes the unprocessed messages with <c>FOR UPDATE SKIP LOCKED</c> (two
/// relays never take the same), asks the Notifications for each, and marks them processed. A crash between the ask and
/// the mark runs the ask again later, and the dedupe key makes that create nothing new.
/// </summary>
/// <remarks>
/// Each message is asked on its own: the Notifications writes on its own connection, so one that fails leaves the
/// others, and this transaction, untouched. A failure counts one attempt and leaves the message for the next run; after
/// <see cref="MaxAttempts"/> failures it is set aside (processed, logged by its id), so a poison message never blocks the line.
/// </remarks>
internal sealed partial class SessionsOutboxRelay(
    SessionsDbContext database, INotificationRequests requests, TimeProvider time, ILogger<SessionsOutboxRelay> logger)
{
    public const int BatchSize = 50;

    /// <summary>Failed tries before a message is set aside: one per drain, so a passing outage over a few writes is survived.</summary>
    public const int MaxAttempts = 5;

    /// <summary>Relays one batch.</summary>
    public async Task<RelayRun> RunAsync(CancellationToken cancellationToken)
    {
        var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            var messages = await database.OutboxMessages
                .FromSql(
                    $"""
                    SELECT * FROM sessions.outbox_messages WHERE processed_at IS NULL
                    ORDER BY occurred_at, id LIMIT {BatchSize} FOR UPDATE SKIP LOCKED
                    """)
                .AsNoTracking().ToListAsync(cancellationToken).ConfigureAwait(false);
            var done = new List<Guid>();
            var failed = new List<OutboxMessageRow>();
            foreach (var message in messages)
            {
                var relayed = await TryRelayAsync(message, cancellationToken).ConfigureAwait(false);
                if (relayed)
                {
                    done.Add(message.Id);
                }
                else
                {
                    failed.Add(message);
                }
            }

            var setAside = failed.Where(message => message.Attempts + 1 >= MaxAttempts).Select(message => message.Id).ToList();
            setAside.ForEach(id => SetAside(logger, id, MaxAttempts));
            var retried = failed.Select(message => message.Id).Except(setAside).ToList();
            await CountAttemptAsync([.. done, .. setAside], time.GetUtcNow(), cancellationToken).ConfigureAwait(false);
            await CountAttemptAsync(retried, processedAt: null, cancellationToken).ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            return new RelayRun(messages.Count, failed.Count);
        }
    }

    /// <summary>True when the message is done with: asked, or out of shape and set aside.</summary>
    private async Task<bool> TryRelayAsync(OutboxMessageRow message, CancellationToken cancellationToken)
    {
        if (OutboxPayload.Read(message.Payload) is not { } payload)
        {
            // Never written by this code: set aside (processed) so it never blocks the line, and logged by its id only.
            PayloadInvalid(logger, message.Id);
            return true;
        }

        try
        {
            await requests.RequestAsync(
                new NotificationRequest(message.DedupeKey, NotificationRequestKind.WaitlistPromoted, payload.MemberId, payload.GroupId, payload.RoundId, payload.StartsAt),
                cancellationToken).ConfigureAwait(false);
            return true;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
#pragma warning disable CA1031 // One message's failure, whatever it is, must leave the others going: counted and tried again (ADR 0069, D3).
        catch (Exception exception)
#pragma warning restore CA1031
        {
            RelayFailed(logger, message.Id, exception.GetType().Name);
            return false;
        }
    }

    /// <summary>One more attempt on each message; a non-null <paramref name="processedAt"/> also takes them out of the line.</summary>
    private async Task CountAttemptAsync(List<Guid> ids, DateTimeOffset? processedAt, CancellationToken cancellationToken)
    {
        if (ids.Count == 0)
        {
            return;
        }

        _ = await database.OutboxMessages.Where(message => ids.Contains(message.Id))
            .ExecuteUpdateAsync(
                update => update.SetProperty(message => message.ProcessedAt, processedAt).SetProperty(message => message.Attempts, message => message.Attempts + 1),
                cancellationToken)
            .ConfigureAwait(false);
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Outbox message {MessageId} has a payload out of shape; set aside.")]
    private static partial void PayloadInvalid(ILogger logger, Guid messageId);

    /// <summary>The reason is the exception's type, never its message (it may quote a value).</summary>
    [LoggerMessage(Level = LogLevel.Warning, Message = "Outbox message {MessageId} was not relayed: {Reason}; tried again on the next run.")]
    private static partial void RelayFailed(ILogger logger, Guid messageId, string reason);

    [LoggerMessage(Level = LogLevel.Error, Message = "Outbox message {MessageId} failed {Attempts} times; set aside.")]
    private static partial void SetAside(ILogger logger, Guid messageId, int attempts);
}
