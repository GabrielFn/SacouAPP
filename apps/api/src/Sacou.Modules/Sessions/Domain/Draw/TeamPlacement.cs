namespace Sacou.Modules.Sessions.Domain.Draw;

/// <summary>Which team a unit tries first, by its position in the order: one after the other, or snake (1-2-2-1).</summary>
internal enum PlacementPattern
{
    InTurn,
    Serpentine,
}

/// <summary>
/// Places the units on the teams in a given order, backtracking when a team is full or a "separar" lock forbids it,
/// so it finds a valid split whenever one exists. Units with locks go first, the most "separar" locks first; empty teams are interchangeable, so
/// only the first one is tried.
/// The result is the team of each unit, numbered by the first unit of each team (<see cref="Canonical"/>).
/// The backtracking stops after <see cref="DrawLimits.MaxPlacementSteps"/> steps: locks that hard to place answer as unsatisfiable.
/// </summary>
internal sealed class TeamPlacement
{
    private const int Unassigned = -1;
    private const int LegsPerLap = 2;

    private static readonly IReadOnlySet<int> NoneLeaving = new HashSet<int>();

    private readonly DrawUnits _units;
    private readonly TeamLayout _layout;
    private readonly IReadOnlyList<int> _order;
    private readonly PlacementPattern _pattern;
    private readonly int[] _teamOfUnit;
    private readonly int[] _load;
    private readonly int _maxSteps;
    private int _steps;

    private TeamPlacement(DrawUnits units, TeamLayout layout, IReadOnlyList<int> order, PlacementPattern pattern, int maxSteps)
    {
        _maxSteps = maxSteps;
        _units = units;
        _layout = layout;
        _order = order;
        _pattern = pattern;
        _teamOfUnit = Enumerable.Repeat(Unassigned, units.Units.Length).ToArray();
        _load = new int[layout.TeamCount];
    }

    /// <summary>Null when no split respects the locks, or none was found within <see cref="DrawLimits.MaxPlacementSteps"/>.</summary>
    public static int[]? Place(DrawUnits units, TeamLayout layout, IReadOnlyList<int> order, PlacementPattern pattern) =>
        Place(units, layout, order, pattern, DrawLimits.MaxPlacementSteps);

    /// <summary>With another ceiling of steps, for the tests of the ceiling.</summary>
    internal static int[]? Place(DrawUnits units, TeamLayout layout, IReadOnlyList<int> order, PlacementPattern pattern, int maxSteps)
    {
        ArgumentNullException.ThrowIfNull(units);
        ArgumentNullException.ThrowIfNull(order);
        // The most constrained first (most "separar" locks, then the biggest), keeping the given order among equals.
        var constrained = order.Where(IsConstrained)
            .OrderByDescending(units.ApartCount)
            .ThenByDescending(unit => units.Units[unit].Size);
        var placement = new TeamPlacement(units, layout, [.. constrained, .. order.Where(unit => !IsConstrained(unit))], pattern, maxSteps);
        return placement.PlaceFrom(0) ? Canonical(placement._teamOfUnit) : null;

        // A player alone and free of locks always fits the room left, so the search only ever backtracks over the others.
        bool IsConstrained(int unit) => units.Units[unit].Size > 1 || units.HasApartLock(unit);
    }

    /// <summary>The same split always reads the same: team 0 holds the first unit, team 1 the first unit not in team 0...</summary>
    public static int[] Canonical(IReadOnlyList<int> teamOfUnit)
    {
        var label = new Dictionary<int, int>();
        return [.. teamOfUnit.Select(team => label.TryGetValue(team, out var known) ? known : label[team] = label.Count)];
    }

    /// <summary>True when no unit already on <paramref name="team"/> is kept apart from <paramref name="unit"/>.</summary>
    public static bool Accepts(DrawUnits units, IReadOnlyList<int> teamOfUnit, int unit, int team, IReadOnlySet<int> leaving) =>
        !Enumerable.Range(0, teamOfUnit.Count)
            .Any(other => teamOfUnit[other] == team && !leaving.Contains(other) && units.AreApart(unit, other));

    private bool PlaceFrom(int position)
    {
        if (position == _order.Count)
        {
            return true;
        }

        if (++_steps > _maxSteps)
        {
            return false;
        }

        var unit = _order[position];
        var size = _units.Units[unit].Size;
        var triedEmptyTeam = false;
        for (var step = 0; step < _layout.TeamCount; step++)
        {
            var team = TeamAt(position, step);
            if (_load[team] + size > _layout.TeamSize
                || (_load[team] == 0 && triedEmptyTeam)
                || !Accepts(_units, _teamOfUnit, unit, team, NoneLeaving))
            {
                continue;
            }

            triedEmptyTeam |= _load[team] == 0;
            if (TryWith(unit, team, size, position))
            {
                return true;
            }
        }

        return false;
    }

    private bool TryWith(int unit, int team, int size, int position)
    {
        _teamOfUnit[unit] = team;
        _load[team] += size;
        if (PlaceFrom(position + 1))
        {
            return true;
        }

        _teamOfUnit[unit] = Unassigned;
        _load[team] -= size;
        return false;
    }

    private int TeamAt(int position, int step)
    {
        var teams = _layout.TeamCount;
        var offset = position % teams;
        var isReturnLeg = _pattern == PlacementPattern.Serpentine && (position / teams) % LegsPerLap == 1;
        var first = isReturnLeg ? teams - 1 - offset : offset;
        return (first + step) % teams;
    }
}
