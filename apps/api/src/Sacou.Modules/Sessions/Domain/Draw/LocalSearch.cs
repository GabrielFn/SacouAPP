using System.Collections.Immutable;

namespace Sacou.Modules.Sessions.Domain.Draw;

/// <summary>
/// For draws too big to try every split: <see cref="DrawLimits.SearchRestarts"/> starts, each a shuffle of the units
/// dealt in snake order by level, then improved by swaps between teams (one unit for another of the same size, or a
/// unit of two for two players alone) until no swap helps. The seed picks one of the distinct best splits.
/// </summary>
internal static class LocalSearch
{
    private const int PairSize = 2;

    /// <summary>Null when no split respects the locks.</summary>
    public static int[]? Find(DrawUnits units, TeamLayout layout, SeededRandom random)
    {
        ArgumentNullException.ThrowIfNull(units);
        ArgumentNullException.ThrowIfNull(layout);
        ArgumentNullException.ThrowIfNull(random);
        var swaps = SwapsOf(units);
        var best = new SortedDictionary<string, int[]>(StringComparer.Ordinal);
        DrawScore? bestScore = null;
        for (var restart = 0; restart < DrawLimits.SearchRestarts; restart++)
        {
            var start = TeamPlacement.Place(units, layout, StartOrder(units, random), PlacementPattern.Serpentine);
            if (start is null)
            {
                return null;
            }

            var split = TeamPlacement.Canonical(Improve(units, layout, swaps, start));
            var score = DrawScore.Of(units, layout, split);
            if (bestScore is not { } current || score.IsBetterThan(current))
            {
                best.Clear();
                bestScore = score;
            }

            if (score.CompareTo(bestScore.Value) == 0)
            {
                best.TryAdd(string.Join(',', split), split);
            }
        }

        return best.Values.ElementAt(random.NextBelow(best.Count));
    }

    /// <summary>Bigger units first, so they still fit; within a size, the stronger first; ties in shuffled order.</summary>
    private static int[] StartOrder(DrawUnits units, SeededRandom random) =>
        [.. random.Shuffle(Enumerable.Range(0, units.Units.Length).ToArray())
            .OrderByDescending(unit => units.Units[unit].Size)
            .ThenByDescending(unit => units.Units[unit].SumTenths)];

    /// <summary>The swaps worth trying, whatever the teams: units of the same size, or a unit of two for two players alone.</summary>
    private static ImmutableArray<Swap> SwapsOf(DrawUnits units)
    {
        var count = units.Units.Length;
        var singles = Enumerable.Range(0, count).Where(unit => units.Units[unit].Size == 1).ToArray();
        var oneForOne =
            from unit in Enumerable.Range(0, count)
            from other in Enumerable.Range(unit + 1, count - unit - 1)
            where units.Units[unit].Size == units.Units[other].Size
            select new Swap([unit], [other]);
        var pairForTwo =
            from unit in Enumerable.Range(0, count)
            where units.Units[unit].Size == PairSize
            from first in singles
            from second in singles
            where first < second
            select new Swap([unit], [first, second]);
        return [.. oneForOne.Concat(pairForTwo)];
    }

    /// <summary>First improvement: applies any allowed swap that lowers the score and starts over, until none does.</summary>
    private static int[] Improve(DrawUnits units, TeamLayout layout, ImmutableArray<Swap> swaps, int[] start)
    {
        var state = new SplitState(units, layout, start);
        while (swaps.Any(state.TryApply))
        {
        }

        return state.TeamOfUnit;
    }

    /// <summary><see cref="Leaving"/> goes to the team of <see cref="Entering"/>, and the other way round.</summary>
    private sealed record Swap(ImmutableArray<int> Leaving, ImmutableArray<int> Entering);

    /// <summary>The split being improved, with the sum of each team kept up to date.</summary>
    private sealed class SplitState
    {
        private readonly DrawUnits _units;
        private readonly int[] _sums;
        private readonly int[] _sizes;
        private DrawScore _score;

        public SplitState(DrawUnits units, TeamLayout layout, int[] start)
        {
            _units = units;
            TeamOfUnit = start;
            _sums = new int[layout.TeamCount];
            _sizes = new int[layout.TeamCount];
            for (var unit = 0; unit < start.Length; unit++)
            {
                _sums[start[unit]] += units.Units[unit].SumTenths;
                _sizes[start[unit]] += units.Units[unit].Size;
            }

            _score = DrawScore.Of(_sums, _sizes);
        }

        public int[] TeamOfUnit { get; }

        public bool TryApply(Swap swap)
        {
            var fromTeam = TeamOfUnit[swap.Leaving[0]];
            var toTeam = TeamOfUnit[swap.Entering[0]];
            if (fromTeam == toTeam || swap.Entering.Any(unit => TeamOfUnit[unit] != toTeam))
            {
                return false;
            }

            var moved = SumOf(swap.Leaving) - SumOf(swap.Entering);
            _sums[fromTeam] -= moved;
            _sums[toTeam] += moved;
            var score = DrawScore.Of(_sums, _sizes);
            if (score.IsBetterThan(_score) && IsAllowed(swap, fromTeam, toTeam))
            {
                Move(swap, fromTeam, toTeam);
                _score = score;
                return true;
            }

            _sums[fromTeam] += moved;
            _sums[toTeam] -= moved;
            return false;
        }

        private int SumOf(ImmutableArray<int> moving) => moving.Sum(unit => _units.Units[unit].SumTenths);

        private bool IsAllowed(Swap swap, int fromTeam, int toTeam)
        {
            var leavingFrom = swap.Leaving.ToHashSet();
            var leavingTo = swap.Entering.ToHashSet();
            return swap.Leaving.All(unit => TeamPlacement.Accepts(_units, TeamOfUnit, unit, toTeam, leavingTo))
                && swap.Entering.All(unit => TeamPlacement.Accepts(_units, TeamOfUnit, unit, fromTeam, leavingFrom));
        }

        private void Move(Swap swap, int fromTeam, int toTeam)
        {
            foreach (var unit in swap.Leaving)
            {
                TeamOfUnit[unit] = toTeam;
            }

            foreach (var unit in swap.Entering)
            {
                TeamOfUnit[unit] = fromTeam;
            }
        }
    }
}
