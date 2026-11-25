using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Metrics;

namespace Sacou.Api.Operations;

/// <summary>
/// Joins the modules' counts into the answer (E7.2, ADR 0085, D3): pure, no clock and no database. Every week shown is
/// present, with 0 when its module counted nothing.
/// </summary>
internal static class OpsMetricsCalculator
{
    public static OpsUsers Users(IdentityMetrics identity, IReadOnlyList<DateOnly> weeks)
    {
        ArgumentNullException.ThrowIfNull(identity);
        ArgumentNullException.ThrowIfNull(weeks);
        return new OpsUsers(
            identity.Registered,
            identity.Deleted,
            [.. weeks.Select(week => new OpsUserWeek(week, CountIn(identity.RegisteredByWeek, week), CountIn(identity.DeletedByWeek, week)))]);
    }

    /// <summary>The count of one week; 0 when the module had no line for it.</summary>
    public static int CountIn(IReadOnlyList<WeeklyCount> counts, DateOnly week)
    {
        ArgumentNullException.ThrowIfNull(counts);
        return counts.Where(count => count.WeekStart == week).Sum(count => count.Count);
    }
}
