using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Sessions.Contracts;
using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Infrastructure;
using Sacou.Shared.Metrics;

namespace Sacou.Modules.Sessions.Metrics;

/// <summary>
/// The Sessions' counts, each one aggregate in Postgres over the <c>sessions</c> schema only (ADR 0085, D2): no round and
/// no answer comes back, only numbers by group and week. The stored values come from <see cref="ColumnValues"/>, so a
/// renamed status cannot silently count nothing.
/// </summary>
internal sealed class PostgresSessionsMetrics(SessionsDbContext database) : ISessionsMetrics
{
    private static readonly string[] Confirmed =
        [ColumnValues.AttendanceStatuses[AttendanceStatus.Going], ColumnValues.AttendanceStatuses[AttendanceStatus.Promoted]];

    private static readonly string Canceled = ColumnValues.RoundStatuses[RoundStatus.Canceled];
    private static readonly string Self = ColumnValues.AttendanceSources[AttendanceSource.Self];
    private static readonly string Regular = ColumnValues.AttendanceSources[AttendanceSource.Regular];
    private static readonly string Web = ColumnValues.AttendanceChannels[AttendanceChannel.Web];

    public async Task<SessionsMetrics> CountAsync(MetricsPeriod period, DateTimeOffset activeSince, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(period);
        database.Database.SetCommandTimeout(MetricsQueries.CommandTimeout);
        var now = period.Now.ToUniversalTime();
        var active = activeSince.ToUniversalTime();
        var since = period.WeeksSince.ToUniversalTime();
        var zone = period.TimeZoneId;
        var totals = await database.Database.SqlQuery<RoundTotalsRow>($"""
            SELECT count(*)::int AS "Created",
                   (count(*) FILTER (WHERE status <> {Canceled} AND starts_at < {now}))::int AS "Held",
                   (count(*) FILTER (WHERE closed_at IS NOT NULL))::int AS "Closed",
                   (count(*) FILTER (WHERE status = {Canceled}))::int AS "Canceled",
                   (count(DISTINCT group_id) FILTER (WHERE status <> {Canceled} AND starts_at < {now} AND starts_at >= {active}))::int AS "ActiveGroups"
            FROM sessions.rounds
            """).SingleAsync(cancellationToken).ConfigureAwait(false);
        var created = await database.Database.SqlQuery<WeeklyCountRow>($"""
            SELECT (date_trunc('week', created_at AT TIME ZONE {zone}))::date AS "WeekStart", count(*)::int AS "Count"
            FROM sessions.rounds WHERE created_at >= {since} GROUP BY 1
            """).ToListAsync(cancellationToken).ConfigureAwait(false);
        var held = await database.Database.SqlQuery<HeldWeekRow>($"""
            SELECT r.group_id AS "GroupId",
                   (date_trunc('week', r.starts_at AT TIME ZONE {zone}))::date AS "WeekStart",
                   count(DISTINCT r.id)::int AS "Rounds",
                   (count(a.round_id) FILTER (WHERE a.status = ANY({Confirmed}) AND a.source <> {Regular}))::int AS "Confirmed",
                   (count(a.round_id) FILTER (WHERE a.status = ANY({Confirmed}) AND a.source = {Self}))::int AS "SelfAnswered",
                   (count(a.round_id) FILTER (WHERE a.status = ANY({Confirmed}) AND a.source = {Self} AND a.channel = {Web}))::int AS "ByLink"
            FROM sessions.rounds r LEFT JOIN sessions.attendances a ON a.round_id = r.id
            WHERE r.status <> {Canceled} AND r.starts_at < {now}
            GROUP BY 1, 2
            """).ToListAsync(cancellationToken).ConfigureAwait(false);
        return new SessionsMetrics(
            totals.Created,
            totals.Held,
            totals.Closed,
            totals.Canceled,
            totals.ActiveGroups,
            [.. created.Select(row => row.ToCount())],
            [.. held.Select(row => new HeldWeek(row.GroupId, row.WeekStart, row.Rounds, row.Confirmed, row.SelfAnswered, row.ByLink))]);
    }

    private sealed class RoundTotalsRow
    {
        public int Created { get; init; }

        public int Held { get; init; }

        public int Closed { get; init; }

        public int Canceled { get; init; }

        public int ActiveGroups { get; init; }
    }

    private sealed class HeldWeekRow
    {
        public Guid GroupId { get; init; }

        public DateOnly WeekStart { get; init; }

        public int Rounds { get; init; }

        public int Confirmed { get; init; }

        public int SelfAnswered { get; init; }

        public int ByLink { get; init; }
    }
}
