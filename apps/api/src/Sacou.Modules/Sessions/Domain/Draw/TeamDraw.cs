using System.Collections.Immutable;
using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Domain.Draw;

/// <summary>
/// The balanced draw with locks and reserves (docs/dominio/sorteio.md, ADR 0055). Pure and deterministic: the same
/// players, in any order, with the same seed, give the same teams. Two teams of up to 16 players try every split
/// (<see cref="ExactSplit"/>); bigger draws use a local search (<see cref="LocalSearch"/>).
/// </summary>
internal static class TeamDraw
{
    public static Result<DrawResult> Run(DrawInput input)
    {
        ArgumentNullException.ThrowIfNull(input);
        var players = input.Players.OrderBy(player => player.Sequence).ToImmutableArray();
        var layout = TeamLayout.For(players.Length, input.PlayersPerTeam);
        if (layout.IsFailure)
        {
            return Result.Failure<DrawResult>(layout.Error);
        }

        var reserves = PickReserves(players, layout.Value.ReserveCount, input.Reserves);
        if (reserves.IsFailure)
        {
            return Result.Failure<DrawResult>(reserves.Error);
        }

        var reserveIds = reserves.Value.Select(player => player.MemberId).ToHashSet();
        var playing = players.Where(player => !reserveIds.Contains(player.MemberId)).ToList();
        var units = DrawUnits.From(playing, input.Locks, layout.Value.TeamSize);
        return units.IsFailure
            ? Result.Failure<DrawResult>(units.Error)
            : Split(input, layout.Value, units.Value, reserves.Value);
    }

    private static Result<DrawResult> Split(DrawInput input, TeamLayout layout, DrawUnits units, ImmutableArray<DrawPlayer> reserves)
    {
        var random = new SeededRandom(input.Seed);
        var budget = PlacementBudget.ForADraw();
        var teamOfUnit = !input.BalanceByLevel ? QuickSplit(units, layout, random, budget)
            : ExactSplit.Applies(layout) ? ExactSplit.Find(units, layout, random)
            : LocalSearch.Find(units, layout, random, budget);
        return teamOfUnit is null
            ? Result.Failure<DrawResult>(DrawErrors.LocksUnsatisfiable)
            : Result.Success(ToResult(input.Seed, layout, units, teamOfUnit, reserves));
    }

    /// <summary>The last ones to arrive, unless the admin sent the queue: then exactly as many, distinct and confirmed.</summary>
    private static Result<ImmutableArray<DrawPlayer>> PickReserves(
        ImmutableArray<DrawPlayer> players, int reserveCount, ImmutableArray<MemberId>? requested)
    {
        if (requested is not { } chosen)
        {
            return Result.Success(players[^reserveCount..]);
        }

        var byId = players.ToDictionary(player => player.MemberId);
        var isValid = chosen.Length == reserveCount
            && chosen.Distinct().Count() == chosen.Length
            && chosen.All(byId.ContainsKey);
        return isValid
            ? Result.Success(chosen.Select(member => byId[member]).ToImmutableArray())
            : Result.Failure<ImmutableArray<DrawPlayer>>(DrawErrors.ReservesInvalid);
    }

    /// <summary>"Sorteio rápido": one shuffle, the units dealt one team after the other, no balancing.</summary>
    private static int[]? QuickSplit(DrawUnits units, TeamLayout layout, SeededRandom random, PlacementBudget budget)
    {
        var order = random.Shuffle(Enumerable.Range(0, units.Units.Length).ToArray())
            .OrderByDescending(unit => units.Units[unit].Size)
            .ToArray();
        return TeamPlacement.Place(units, layout, order, PlacementPattern.InTurn, budget);
    }

    private static DrawResult ToResult(
        ulong seed, TeamLayout layout, DrawUnits units, int[] teamOfUnit, ImmutableArray<DrawPlayer> reserves)
    {
        var teams = Enumerable.Range(0, layout.TeamCount)
            .Select(team => TeamOf(team, units, teamOfUnit))
            .ToImmutableArray();
        var difference = DrawBalance.DifferenceTenths([.. teams.Select(team => team.AverageTenths)]);
        return new DrawResult(seed, layout.TeamSize, teams, reserves, difference);
    }

    private static DrawnTeam TeamOf(int team, DrawUnits units, int[] teamOfUnit)
    {
        var members = units.Units.Where((_, unit) => teamOfUnit[unit] == team)
            .SelectMany(unit => unit.Players)
            .OrderBy(player => player.Sequence)
            .ToImmutableArray();
        var average = DrawBalance.AverageTenths([.. members.Select(player => player.LevelTenths)]);
        return new DrawnTeam(team + 1, members, average);
    }
}
