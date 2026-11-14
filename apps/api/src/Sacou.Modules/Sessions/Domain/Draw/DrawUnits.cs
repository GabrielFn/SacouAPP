using System.Collections.Immutable;
using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Domain.Draw;

/// <summary>Players that go to the same team: one player alone, or everyone the "together" locks join.</summary>
internal sealed record DrawUnit(ImmutableArray<DrawPlayer> Players)
{
    public int Size => Players.Length;

    public int SumTenths => Players.Sum(player => player.LevelTenths);

    public override string ToString() => nameof(DrawUnit);
}

/// <summary>
/// The "together" locks join players into units, transitively (A-B and B-C make one unit of three); the "apart" locks
/// forbid two units on the same team. Units come in order of arrival of their first player, so the same locks in any
/// order give the same units.
/// </summary>
internal sealed class DrawUnits
{
    private readonly ImmutableHashSet<(int Low, int High)> _apart;

    private DrawUnits(ImmutableArray<DrawUnit> units, ImmutableHashSet<(int Low, int High)> apart)
    {
        Units = units;
        _apart = apart;
    }

    public ImmutableArray<DrawUnit> Units { get; }

    public bool AreApart(int unit, int other) => _apart.Contains(Pair(unit, other));

    public bool HasApartLock(int unit) => _apart.Any(pair => pair.Low == unit || pair.High == unit);

    /// <summary><paramref name="playing"/> is in order of arrival and holds only the players of the teams.</summary>
    public static Result<DrawUnits> From(IReadOnlyList<DrawPlayer> playing, IReadOnlyList<DrawLock> locks, int teamSize)
    {
        ArgumentNullException.ThrowIfNull(playing);
        ArgumentNullException.ThrowIfNull(locks);
        var positions = playing.Select((player, position) => (player.MemberId, position)).ToDictionary();
        if (!AreValid(locks, positions))
        {
            return Result.Failure<DrawUnits>(DrawErrors.LockInvalid);
        }

        var unitOfPlayer = JoinTogether(playing.Count, locks, positions);
        var units = BuildUnits(playing, unitOfPlayer);
        if (units.Any(unit => unit.Size > teamSize))
        {
            return Result.Failure<DrawUnits>(DrawErrors.LockTooLarge);
        }

        var apart = locks.Where(drawLock => drawLock.Kind == DrawLockKind.Apart)
            .Select(drawLock => Pair(unitOfPlayer[positions[drawLock.First]], unitOfPlayer[positions[drawLock.Second]]))
            .ToImmutableHashSet();
        return apart.Any(pair => pair.Low == pair.High)
            ? Result.Failure<DrawUnits>(DrawErrors.LocksConflict)
            : Result.Success(new DrawUnits(units, apart));
    }

    private static bool AreValid(IReadOnlyList<DrawLock> locks, Dictionary<MemberId, int> positions)
    {
        if (locks.Count > DrawLimits.MaxLocks)
        {
            return false;
        }

        var seen = new HashSet<(int Low, int High, DrawLockKind Kind)>();
        foreach (var drawLock in locks)
        {
            var known = positions.TryGetValue(drawLock.First, out var first) & positions.TryGetValue(drawLock.Second, out var second);
            if (!known || first == second || !seen.Add((Math.Min(first, second), Math.Max(first, second), drawLock.Kind)))
            {
                return false;
            }
        }

        return true;
    }

    /// <summary>Union-find whose root is the earliest arrival, then numbered in that order.</summary>
    private static int[] JoinTogether(int playerCount, IReadOnlyList<DrawLock> locks, Dictionary<MemberId, int> positions)
    {
        var root = Enumerable.Range(0, playerCount).ToArray();
        foreach (var drawLock in locks.Where(drawLock => drawLock.Kind == DrawLockKind.Together))
        {
            var first = RootOf(root, positions[drawLock.First]);
            var second = RootOf(root, positions[drawLock.Second]);
            root[Math.Max(first, second)] = Math.Min(first, second);
        }

        var unitOfRoot = new Dictionary<int, int>();
        var unitOfPlayer = new int[playerCount];
        for (var player = 0; player < playerCount; player++)
        {
            var playerRoot = RootOf(root, player);
            if (!unitOfRoot.TryGetValue(playerRoot, out var unit))
            {
                unit = unitOfRoot.Count;
                unitOfRoot[playerRoot] = unit;
            }

            unitOfPlayer[player] = unit;
        }

        return unitOfPlayer;
    }

    private static int RootOf(int[] root, int player)
    {
        while (root[player] != player)
        {
            player = root[player];
        }

        return player;
    }

    private static ImmutableArray<DrawUnit> BuildUnits(IReadOnlyList<DrawPlayer> playing, int[] unitOfPlayer) =>
        [.. playing.Select((player, position) => (player, unit: unitOfPlayer[position]))
            .GroupBy(entry => entry.unit)
            .OrderBy(group => group.Key)
            .Select(group => new DrawUnit([.. group.Select(entry => entry.player)]))];

    private static (int Low, int High) Pair(int unit, int other) => (Math.Min(unit, other), Math.Max(unit, other));
}
