namespace Sacou.Modules.Sessions.Domain.Draw;

/// <summary>
/// For draws too big to try every split: <see cref="DrawLimits.SearchRestarts"/> starts, each a shuffle of the units
/// dealt in snake order by level, then improved by swaps between two teams until no swap helps. A swap trades a group
/// for another of the same size, a group being one unit or two players alone: one for one, two for two, a locked pair
/// for two players. The seed picks one of the distinct best splits. The search stops early once it holds
/// <see cref="EnoughChoices"/> splits whose gap is the lowest the levels allow (<see cref="LowestPossibleGap"/>), which
/// is the optimum. Every team has the same size (<see cref="TeamLayout"/>).
/// </summary>
internal static class LocalSearch
{
    private const int ByLevelEvery = 2;
    private const int EnoughChoices = 8;

    /// <summary>Null when no split respects the locks.</summary>
    public static int[]? Find(DrawUnits units, TeamLayout layout, SeededRandom random)
    {
        ArgumentNullException.ThrowIfNull(units);
        ArgumentNullException.ThrowIfNull(layout);
        ArgumentNullException.ThrowIfNull(random);
        var best = new SortedDictionary<string, int[]>(StringComparer.Ordinal);
        DrawScore? bestScore = null;
        var lowest = LowestPossibleGap(units, layout);
        for (var restart = 0; restart < DrawLimits.SearchRestarts && !IsSettled(bestScore, lowest, best.Count); restart++)
        {
            var start = TeamPlacement.Place(units, layout, StartOrder(units, random, restart), PlacementPattern.Serpentine);
            if (start is null)
            {
                // The first start failing means no split, or none within the step cap; a later one failing only skips it.
                if (bestScore is null)
                {
                    return null;
                }

                continue;
            }

            var split = TeamPlacement.Canonical(Improve(units, layout, start));
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

    /// <summary>
    /// Every team sum is a multiple of the greatest common divisor of the unit sums, so no split has a gap below one
    /// divisor, or zero when the total divides evenly. At that gap the sums can only be the two neighbours, their
    /// count fixed by the total, so the spread of the sums is fixed too: the score is the optimum.
    /// </summary>
    private static DrawScore LowestPossibleGap(DrawUnits units, TeamLayout layout)
    {
        var divisor = units.Units.Select(unit => unit.SumTenths).Aggregate(GreatestCommonDivisor);
        var steps = units.Units.Sum(unit => unit.SumTenths) / divisor;
        var sumGap = steps % layout.TeamCount == 0 ? 0 : divisor;
        return DrawScore.Of([0, sumGap], [layout.TeamSize, layout.TeamSize]);
    }

    private static bool IsSettled(DrawScore? bestScore, DrawScore lowest, int choices) =>
        bestScore is { } best && best.SameGapAs(lowest) && choices >= EnoughChoices;

    private static int GreatestCommonDivisor(int first, int second) =>
        second == 0 ? first : GreatestCommonDivisor(second, first % second);

    /// <summary>
    /// Bigger units first, so they still fit. Every other start deals the stronger first within a size; the rest keep
    /// the shuffled order, so the starts differ even where the locks leave few choices.
    /// </summary>
    private static int[] StartOrder(DrawUnits units, SeededRandom random, int restart)
    {
        var bySize = random.Shuffle(Enumerable.Range(0, units.Units.Length).ToArray())
            .OrderByDescending(unit => units.Units[unit].Size);
        return restart % ByLevelEvery == 0 ? [.. bySize.ThenByDescending(unit => units.Units[unit].SumTenths)] : [.. bySize];
    }

    private static int[] Improve(DrawUnits units, TeamLayout layout, int[] start)
    {
        var state = new SplitState(units, layout, start);
        while (state.TryImproveOnce())
        {
        }

        return state.TeamOfUnit;
    }

    /// <summary>One unit (<see cref="Second"/> is <see cref="None"/>) or two players alone, moved together.</summary>
    private readonly record struct Group(int First, int Second, int Size, int SumTenths)
    {
        public const int None = -1;

        public static readonly Func<Group, bool> IsSingleUnit = group => group.Second == None;

        public static readonly Func<Group, bool> Any = _ => true;

        public int[] Units => Second == None ? [First] : [First, Second];
    }

    /// <summary>The split being improved, with the sum of each team kept up to date.</summary>
    private sealed class SplitState
    {
        private const int PairSize = 2;

        private readonly DrawUnits _units;
        private readonly int _teamCount;
        private readonly int[] _sums;
        private readonly int[] _sizes;
        private DrawScore _score;

        public SplitState(DrawUnits units, TeamLayout layout, int[] start)
        {
            _units = units;
            _teamCount = layout.TeamCount;
            TeamOfUnit = start;
            _sums = new int[_teamCount];
            _sizes = new int[_teamCount];
            for (var unit = 0; unit < start.Length; unit++)
            {
                _sums[start[unit]] += units.Units[unit].SumTenths;
                _sizes[start[unit]] += units.Units[unit].Size;
            }

            _score = DrawScore.Of(_sums, _sizes);
        }

        public int[] TeamOfUnit { get; }

        /// <summary>
        /// Applies the first swap that lowers the score, trying units one for one before the swaps with two players
        /// alone, which are far more numerous; false when none does.
        /// </summary>
        public bool TryImproveOnce()
        {
            var groups = Enumerable.Range(0, _teamCount).Select(GroupsOf).ToArray();
            return TryEveryPair(groups, Group.IsSingleUnit) || TryEveryPair(groups, Group.Any);
        }

        private bool TryEveryPair(List<Group>[] groups, Func<Group, bool> kind)
        {
            for (var left = 0; left < _teamCount; left++)
            {
                for (var right = left + 1; right < _teamCount; right++)
                {
                    if (TrySwapBetween(left, right, [.. groups[left].Where(kind)], [.. groups[right].Where(kind)]))
                    {
                        return true;
                    }
                }
            }

            return false;
        }

        private List<Group> GroupsOf(int team)
        {
            var members = Enumerable.Range(0, TeamOfUnit.Length).Where(unit => TeamOfUnit[unit] == team).ToList();
            var singles = members.Where(unit => _units.Units[unit].Size == 1).ToList();
            var alone = members.Select(unit => new Group(unit, Group.None, _units.Units[unit].Size, _units.Units[unit].SumTenths));
            var twos =
                from first in Enumerable.Range(0, singles.Count)
                from second in Enumerable.Range(first + 1, singles.Count - first - 1)
                select new Group(
                    singles[first], singles[second], PairSize, _units.Units[singles[first]].SumTenths + _units.Units[singles[second]].SumTenths);
            return [.. alone.Concat(twos)];
        }

        private bool TrySwapBetween(int left, int right, List<Group> leftGroups, List<Group> rightGroups)
        {
            foreach (var leaving in leftGroups)
            {
                foreach (var entering in rightGroups)
                {
                    if (leaving.Size == entering.Size && leaving.SumTenths != entering.SumTenths
                        && TrySwap(leaving, entering, left, right))
                    {
                        return true;
                    }
                }
            }

            return false;
        }

        private bool TrySwap(Group leaving, Group entering, int left, int right)
        {
            var moved = leaving.SumTenths - entering.SumTenths;
            if (!CanImprove(moved, left, right))
            {
                return false;
            }

            _sums[left] -= moved;
            _sums[right] += moved;
            var score = DrawScore.Of(_sums, _sizes);
            if (score.IsBetterThan(_score) && IsAllowed(leaving, entering, left, right))
            {
                Move(leaving, right);
                Move(entering, left);
                _score = score;
                return true;
            }

            _sums[left] += moved;
            _sums[right] -= moved;
            return false;
        }

        /// <summary>
        /// A cheap test before the score: the spread of the sums falls only if <c>moved × (moved + right − left)</c> is
        /// negative, and the gap only if one of the two teams holds the highest or the lowest sum.
        /// </summary>
        private bool CanImprove(int moved, int left, int right)
        {
            var spreadChange = (long)moved * (moved + _sums[right] - _sums[left]);
            return spreadChange < 0 || IsExtreme(left) || IsExtreme(right);
        }

        private bool IsExtreme(int team) => _sums[team] == _sums.Max() || _sums[team] == _sums.Min();

        private bool IsAllowed(Group leaving, Group entering, int left, int right)
        {
            var leavingLeft = leaving.Units.ToHashSet();
            var leavingRight = entering.Units.ToHashSet();
            return leaving.Units.All(unit => TeamPlacement.Accepts(_units, TeamOfUnit, unit, right, leavingRight))
                && entering.Units.All(unit => TeamPlacement.Accepts(_units, TeamOfUnit, unit, left, leavingLeft));
        }

        private void Move(Group group, int team)
        {
            foreach (var unit in group.Units)
            {
                TeamOfUnit[unit] = team;
            }
        }
    }
}
