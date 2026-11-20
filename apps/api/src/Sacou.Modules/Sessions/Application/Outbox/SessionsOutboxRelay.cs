using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Sacou.Modules.Notifications.Contracts;
using Sacou.Modules.Sessions.Infrastructure;
using Sacou.Modules.Sessions.Infrastructure.Outbox;

namespace Sacou.Modules.Sessions.Application.Outbox;

/// <summary>
/// The relay (ADR 0069, D2): in one transaction, takes the unprocessed messages with <c>FOR UPDATE SKIP LOCKED</c> (two
/// relays never take the same), asks the Notifications for each, and marks them processed. A crash between the ask and
/// the mark runs the ask again later, and the dedupe key makes that create nothing new.
/// </summary>
internal sealed partial class SessionsOutboxRelay(
    SessionsDbContext database, INotificationRequests requests, TimeProvider time, ILogger<SessionsOutboxRelay> logger)
{
    public const int BatchSize = 50;

    /// <summary>Relays one batch; answers how many messages it took.</summary>
    public async Task<int> RunAsync(CancellationToken cancellationToken)
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
            foreach (var message in messages)
            {
                await RelayAsync(message, cancellationToken).ConfigureAwait(false);
            }

            var ids = messages.Select(message => message.Id).ToList();
            var now = time.GetUtcNow();
            _ = await database.OutboxMessages.Where(message => ids.Contains(message.Id))
                .ExecuteUpdateAsync(
                    update => update.SetProperty(message => message.ProcessedAt, now).SetProperty(message => message.Attempts, message => message.Attempts + 1),
                    cancellationToken)
                .ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            return messages.Count;
        }
    }

    private async Task RelayAsync(OutboxMessageRow message, CancellationToken cancellationToken)
    {
        if (OutboxPayload.Read(message.Payload) is not { } payload)
        {
            // Never written by this code: set aside (processed) so it never blocks the line, and logged by its id only.
            PayloadInvalid(logger, message.Id);
            return;
        }

        await requests.RequestAsync(
            new NotificationRequest(message.DedupeKey, NotificationRequestKind.WaitlistPromoted, payload.MemberId, payload.GroupId, payload.RoundId, payload.StartsAt),
            cancellationToken).ConfigureAwait(false);
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Outbox message {MessageId} has a payload out of shape; set aside.")]
    private static partial void PayloadInvalid(ILogger logger, Guid messageId);
}
