namespace Sacou.Modules.Sessions.Domain.Draw;

/// <summary>
/// The meter of screen 07: each team's average, rounded to the tenth of a point (half up), and the gap between the
/// highest and the lowest rounded average, the same sum the admin sees on the screen (ADR 0055). Shared with the app,
/// which recalculates it after a "Trocar": golden file <c>packages/volley-rules/golden/draw-balance.json</c>.
/// The optimisation never uses it: it compares the exact averages (<see cref="DrawScore"/>).
/// </summary>
internal static class DrawBalance
{
    private const int HalfUpFactor = 2;

    /// <summary>Levels are tenths of a point, so the average is also in tenths: 220 over 6 is 36,67, shown as 3,7.</summary>
    public static int AverageTenths(IReadOnlyCollection<int> levelsTenths)
    {
        ArgumentNullException.ThrowIfNull(levelsTenths);
        ArgumentOutOfRangeException.ThrowIfZero(levelsTenths.Count);
        return AverageTenths(levelsTenths.Sum(), levelsTenths.Count);
    }

    public static int AverageTenths(int sumTenths, int size)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(sumTenths);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(size);
        return ((HalfUpFactor * sumTenths) + size) / (HalfUpFactor * size);
    }

    public static int DifferenceTenths(IReadOnlyCollection<int> averagesTenths)
    {
        ArgumentNullException.ThrowIfNull(averagesTenths);
        ArgumentOutOfRangeException.ThrowIfZero(averagesTenths.Count);
        return averagesTenths.Max() - averagesTenths.Min();
    }
}
