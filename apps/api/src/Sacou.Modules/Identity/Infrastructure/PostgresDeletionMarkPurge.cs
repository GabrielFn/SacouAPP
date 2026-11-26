using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Retention;

namespace Sacou.Modules.Identity.Infrastructure;

/// <summary>
/// The purge of E6.5: every deletion mark older than <see cref="DeletionMarkRetention.Period"/> goes, in batches of
/// <see cref="BatchSize"/>. The cut is strict (<c>deleted_at &lt; now - 60 days</c>), the same edge as
/// <see cref="DeletionMarkRetention.Covers"/>: a dump the reapply guard accepts never needs a mark already gone. Logs only
/// how many marks went (ADR 0056, D11): never a hash, never a date.
/// </summary>
internal sealed partial class PostgresDeletionMarkPurge(IdentityDbContext database, ILogger<PostgresDeletionMarkPurge> logger) : IRetentionCleanup
{
    /// <summary>As the Notifications' cleanup: a short statement each, and the route's budget checked between them.</summary>
    public const int BatchSize = 500;

    public async Task CleanUpAsync(DateTimeOffset now, CancellationToken cancellationToken)
    {
        var before = now - DeletionMarkRetention.Period;
        var total = 0;
        int deleted;
        do
        {
            deleted = await database.Database.ExecuteSqlAsync(
                $"""
                DELETE FROM identity.deleted_accounts WHERE subject_hash IN (
                    SELECT subject_hash FROM identity.deleted_accounts WHERE deleted_at < {before}
                    LIMIT {BatchSize})
                """,
                cancellationToken).ConfigureAwait(false);
            total += deleted;
        }
        while (deleted == BatchSize && !cancellationToken.IsCancellationRequested);

        if (total > 0)
        {
            Purged(logger, total);
        }
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Deletion marks purged: {Count}.")]
    private static partial void Purged(ILogger logger, int count);
}
