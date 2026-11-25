namespace Sacou.Shared.Metrics;

/// <summary>What every module's count query keeps to (E7.2, ADR 0085, D2).</summary>
public static class MetricsQueries
{
    /// <summary>
    /// The longest one count may run: the Neon of the pilot may be waking up, and the dashboard says "try again" instead
    /// of holding a connection of the pool.
    /// </summary>
    public static readonly TimeSpan CommandTimeout = TimeSpan.FromSeconds(5);
}

/// <summary>One line of a weekly count as Postgres returns it: the Monday of the week and how many.</summary>
public sealed class WeeklyCountRow
{
    public DateOnly WeekStart { get; init; }

    public int Count { get; init; }

    public WeeklyCount ToCount() => new(WeekStart, Count);
}
