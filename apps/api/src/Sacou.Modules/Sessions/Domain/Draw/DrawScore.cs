namespace Sacou.Modules.Sessions.Domain.Draw;

/// <summary>
/// The objective of the draw, smaller is better, in whole numbers (ADR 0055): first the gap between the highest and
/// the lowest exact average, as a fraction, so teams of different sizes compare by cross product; then the sum of the
/// squared team sums, which for a fixed total is the spread of the sums around their mean. The seed breaks what is left.
/// </summary>
internal readonly record struct DrawScore(long GapNumerator, long GapDenominator, long SquaredSums) : IComparable<DrawScore>
{
    public static DrawScore Of(IReadOnlyList<int> sums, IReadOnlyList<int> sizes)
    {
        ArgumentNullException.ThrowIfNull(sums);
        ArgumentNullException.ThrowIfNull(sizes);
        ArgumentOutOfRangeException.ThrowIfNotEqual(sums.Count, sizes.Count);
        ArgumentOutOfRangeException.ThrowIfZero(sums.Count);

        var highest = 0;
        var lowest = 0;
        long squaredSums = 0;
        for (var team = 0; team < sums.Count; team++)
        {
            ArgumentOutOfRangeException.ThrowIfNegativeOrZero(sizes[team]);
            highest = AverageIsBelow(sums, sizes, highest, team) ? team : highest;
            lowest = AverageIsBelow(sums, sizes, team, lowest) ? team : lowest;
            squaredSums += (long)sums[team] * sums[team];
        }

        var gapNumerator = ((long)sums[highest] * sizes[lowest]) - ((long)sums[lowest] * sizes[highest]);
        return new DrawScore(gapNumerator, (long)sizes[highest] * sizes[lowest], squaredSums);
    }

    /// <summary>The score of a split: <paramref name="teamOfUnit"/> gives the team of each unit.</summary>
    public static DrawScore Of(DrawUnits units, TeamLayout layout, IReadOnlyList<int> teamOfUnit)
    {
        ArgumentNullException.ThrowIfNull(units);
        ArgumentNullException.ThrowIfNull(layout);
        ArgumentNullException.ThrowIfNull(teamOfUnit);
        var sums = new int[layout.TeamCount];
        var sizes = new int[layout.TeamCount];
        for (var unit = 0; unit < teamOfUnit.Count; unit++)
        {
            sums[teamOfUnit[unit]] += units.Units[unit].SumTenths;
            sizes[teamOfUnit[unit]] += units.Units[unit].Size;
        }

        return Of(sums, sizes);
    }

    public int CompareTo(DrawScore other)
    {
        var byGap = (GapNumerator * other.GapDenominator).CompareTo(other.GapNumerator * GapDenominator);
        return byGap != 0 ? byGap : SquaredSums.CompareTo(other.SquaredSums);
    }

    /// <summary>Same gap of averages, whatever the denominators: 1/2 and 2/4 tie.</summary>
    public bool SameGapAs(DrawScore other) => GapNumerator * other.GapDenominator == other.GapNumerator * GapDenominator;

    public bool IsBetterThan(DrawScore other) => CompareTo(other) < 0;

    /// <summary>The sums come from private levels: never printed.</summary>
    public override string ToString() => nameof(DrawScore);

    private static bool AverageIsBelow(IReadOnlyList<int> sums, IReadOnlyList<int> sizes, int team, int other) =>
        (long)sums[team] * sizes[other] < (long)sums[other] * sizes[team];
}
