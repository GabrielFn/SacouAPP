namespace Sacou.Modules.Matches.Domain.CourtSessions.PlayerStatistics;

/// <summary>Port of <c>stats/compare.ts</c>.</summary>
internal static class Comparisons
{
    /// <summary>The first criterion that tells two candidates apart: negative when the first comes first, 0 on a full tie.</summary>
    public static int FirstDifference(params ReadOnlySpan<int> comparisons)
    {
        foreach (var comparison in comparisons)
        {
            if (comparison != 0)
            {
                return comparison;
            }
        }

        return 0;
    }

    /// <summary>The candidate that comes first; on a tie, the earliest one in the list (stable), or <c>null</c> for none.</summary>
    public static T? FirstOf<T>(IEnumerable<T> candidates, Func<T, T, int> compare)
        where T : class =>
        candidates.Aggregate<T, T?>(null, (best, candidate) => best is null || compare(candidate, best) < 0 ? candidate : best);
}
