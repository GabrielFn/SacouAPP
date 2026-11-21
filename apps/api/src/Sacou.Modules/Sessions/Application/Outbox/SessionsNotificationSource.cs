using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Notifications.Contracts;
using Sacou.Modules.Sessions.Infrastructure;

namespace Sacou.Modules.Sessions.Application.Outbox;

/// <summary>The Sessions' outbox seen by the Notifications (ADR 0069, D3, D10 and D12): its relay and its retention.</summary>
internal sealed class SessionsNotificationSource(SessionsOutboxRelay relay, SessionsDbContext database) : INotificationSource
{
    /// <summary>A processed row is kept this long: enough to look into a complaint about a push.</summary>
    public static readonly TimeSpan ProcessedRetention = TimeSpan.FromDays(7);

    /// <summary>A row set aside is kept longer, for whoever answers its alert.</summary>
    public static readonly TimeSpan SetAsideRetention = TimeSpan.FromDays(30);

    /// <summary>Rows per delete, so a cleanup never holds a long lock.</summary>
    public const int CleanUpBatchSize = 500;

    public async Task RelayAsync(CancellationToken cancellationToken)
    {
        RelayRun run;
        do
        {
            run = await relay.RunAsync(cancellationToken).ConfigureAwait(false);
        }
        while (run.Taken == SessionsOutboxRelay.BatchSize && run.Failed == 0 && !cancellationToken.IsCancellationRequested);
    }

    public async Task CleanUpAsync(DateTimeOffset now, CancellationToken cancellationToken)
    {
        var processedBefore = now - ProcessedRetention;
        var setAsideBefore = now - SetAsideRetention;
        int deleted;
        do
        {
            deleted = await database.Database.ExecuteSqlAsync(
                $"""
                DELETE FROM sessions.outbox_messages WHERE id IN (
                    SELECT id FROM sessions.outbox_messages
                    WHERE processed_at < {processedBefore} OR set_aside_at < {setAsideBefore}
                    LIMIT {CleanUpBatchSize})
                """,
                cancellationToken).ConfigureAwait(false);
        }
        while (deleted == CleanUpBatchSize && !cancellationToken.IsCancellationRequested);
    }
}
