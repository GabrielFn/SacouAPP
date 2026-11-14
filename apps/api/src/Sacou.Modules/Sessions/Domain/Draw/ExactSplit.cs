namespace Sacou.Modules.Sessions.Domain.Draw;

/// <summary>
/// Two teams of up to 16 players: every split that respects the locks is tried (at most 6.435), and the seed picks one
/// of the best. The pilot always lands here, so the acceptance never depends on a heuristic (ADR 0055).
/// </summary>
internal static class ExactSplit
{
    private const int FirstUnit = 0;
    private const int FirstTeam = 0;

    public static bool Applies(TeamLayout layout)
    {
        ArgumentNullException.ThrowIfNull(layout);
        return layout.TeamCount == DrawLimits.MinTeams && layout.PlayingCount <= DrawLimits.MaxPlayersForExactSplit;
    }

    /// <summary>Null when no split respects the locks.</summary>
    public static int[]? Find(DrawUnits units, TeamLayout layout, SeededRandom random)
    {
        ArgumentNullException.ThrowIfNull(units);
        ArgumentNullException.ThrowIfNull(random);
        var search = new Search(units, layout);
        search.Visit(FirstUnit);
        return search.Best.Count == 0 ? null : search.Best[random.NextBelow(search.Best.Count)];
    }

    /// <summary>The first unit always goes to team 0, so a split and its mirror are counted once.</summary>
    private sealed class Search(DrawUnits units, TeamLayout layout)
    {
        private readonly int[] _teamOfUnit = new int[units.Units.Length];
        private readonly int[] _load = new int[layout.TeamCount];
        private DrawScore? _bestScore;

        public List<int[]> Best { get; } = [];

        public void Visit(int unit)
        {
            if (unit == _teamOfUnit.Length)
            {
                Record();
                return;
            }

            var lastTeam = unit == FirstUnit ? FirstTeam : layout.TeamCount - 1;
            for (var team = FirstTeam; team <= lastTeam; team++)
            {
                var size = units.Units[unit].Size;
                if (_load[team] + size <= layout.TeamSize && AcceptsSoFar(unit, team))
                {
                    _teamOfUnit[unit] = team;
                    _load[team] += size;
                    Visit(unit + 1);
                    _load[team] -= size;
                }
            }
        }

        private bool AcceptsSoFar(int unit, int team) =>
            !Enumerable.Range(0, unit).Any(other => _teamOfUnit[other] == team && units.AreApart(unit, other));

        private void Record()
        {
            var score = DrawScore.Of(units, layout, _teamOfUnit);
            if (_bestScore is { } best && score.CompareTo(best) > 0)
            {
                return;
            }

            if (_bestScore is not { } current || score.IsBetterThan(current))
            {
                Best.Clear();
                _bestScore = score;
            }

            Best.Add([.. _teamOfUnit]);
        }
    }
}
