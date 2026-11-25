using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Identity.Infrastructure;
using Sacou.Shared.Metrics;

namespace Sacou.Modules.Identity.Metrics;

/// <summary>
/// The Identity's counts, each one aggregate in Postgres over the <c>identity</c> schema only (ADR 0085, D2): no row comes
/// back, and the week is the Monday of the local date in the period's zone, as <c>date_trunc('week', …)</c> gives it.
/// </summary>
internal sealed class PostgresIdentityMetrics(IdentityDbContext database) : IIdentityMetrics
{
    public async Task<IdentityMetrics> CountAsync(MetricsPeriod period, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(period);
        database.Database.SetCommandTimeout(MetricsQueries.CommandTimeout);
        var zone = period.TimeZoneId;
        var since = period.WeeksSince.ToUniversalTime();
        var registered = await CountAsync(database.Database.SqlQuery<int>($"SELECT count(*)::int AS \"Value\" FROM identity.users"), cancellationToken).ConfigureAwait(false);
        var deleted = await CountAsync(database.Database.SqlQuery<int>($"SELECT count(*)::int AS \"Value\" FROM identity.deleted_accounts"), cancellationToken).ConfigureAwait(false);
        var registeredByWeek = await WeeklyAsync(
            database.Database.SqlQuery<WeeklyCountRow>($"""
                SELECT (date_trunc('week', created_at AT TIME ZONE {zone}))::date AS "WeekStart", count(*)::int AS "Count"
                FROM identity.users WHERE created_at >= {since} GROUP BY 1
                """),
            cancellationToken).ConfigureAwait(false);
        var deletedByWeek = await WeeklyAsync(
            database.Database.SqlQuery<WeeklyCountRow>($"""
                SELECT (date_trunc('week', deleted_at AT TIME ZONE {zone}))::date AS "WeekStart", count(*)::int AS "Count"
                FROM identity.deleted_accounts WHERE deleted_at >= {since} GROUP BY 1
                """),
            cancellationToken).ConfigureAwait(false);
        return new IdentityMetrics(registered, deleted, registeredByWeek, deletedByWeek);
    }

    private static Task<int> CountAsync(IQueryable<int> query, CancellationToken cancellationToken) =>
        query.SingleAsync(cancellationToken);

    private static async Task<IReadOnlyList<WeeklyCount>> WeeklyAsync(IQueryable<WeeklyCountRow> query, CancellationToken cancellationToken)
    {
        var rows = await query.ToListAsync(cancellationToken).ConfigureAwait(false);
        return [.. rows.Select(row => row.ToCount())];
    }
}
