using Sacou.Modules.Sessions.Domain.Draw;
using Xunit;
using static Sacou.Modules.Sessions.Tests.Draw.DrawFixture;

namespace Sacou.Modules.Sessions.Tests.Draw;

/// <summary>The ceiling of steps of the placement within the "separar" locks (ADR 0055, part 2).</summary>
public sealed class TeamPlacementTests
{
    private const int Level = 30;
    private const int TwelvePerTeam = 12;
    private const int LongestOddCycle = 23;
    private const int FiveTeams = 5;
    private const int RandomCases = 100;
    private const int MinLockedPlayers = 12;
    private const int LockedPlayersSpread = 13;

    /// <summary>Far below <see cref="DrawLimits.MaxPlacementSteps"/>: the worst case measured took 1.184 steps.</summary>
    private const int TightCeiling = 10_000;

    [Fact]
    public void AboveTheCeiling_NoSplit_EvenWhenOneExists()
    {
        var (units, layout) = Draw(Indoor * 2, Indoor, [Apart(Member(1), Member(2))]);

        Assert.NotNull(TeamPlacement.Place(units, layout, Order(units), PlacementPattern.InTurn));
        Assert.Null(TeamPlacement.Place(units, layout, Order(units), PlacementPattern.InTurn, maxSteps: 1));
    }

    /// <summary>The longest odd cycle that fits in 24 locks, in two teams of 12: no split, found well within a tight ceiling.</summary>
    [Fact]
    public void AnOddCycleInTwoTeams_IsRefusedWithinATightCeiling()
    {
        DrawLock[] cycle = [.. Enumerable.Range(1, LongestOddCycle).Select(member => Apart(Member(member), Member((member % LongestOddCycle) + 1)))];
        var (units, layout) = Draw(TwelvePerTeam * 2, TwelvePerTeam, cycle);

        Assert.Null(TeamPlacement.Place(units, layout, Order(units), PlacementPattern.Serpentine, int.MaxValue));
        Assert.Null(TeamPlacement.Place(units, layout, Order(units), PlacementPattern.Serpentine, TightCeiling));
    }

    /// <summary>
    /// Random sets of 24 "separar" locks among the first 12 to 24 players, in five teams of six (before the most locked
    /// went first, one of these took 626.443 steps): the tight ceiling never changes the answer.
    /// </summary>
    [Fact]
    public void RandomApartLocks_TheTightCeilingNeverChangesTheAnswer()
    {
        var random = new SeededRandom(Seed);
        var players = Indoor * FiveTeams;
        for (var trial = 0; trial < RandomCases; trial++)
        {
            var (units, layout) = Draw(players, Indoor, RandomApart(random, MinLockedPlayers + (trial % LockedPlayersSpread)));

            var unlimited = TeamPlacement.Place(units, layout, Order(units), PlacementPattern.Serpentine, int.MaxValue);
            var tight = TeamPlacement.Place(units, layout, Order(units), PlacementPattern.Serpentine, TightCeiling);

            Assert.Equal(unlimited, tight);
        }
    }

    private static DrawLock[] RandomApart(SeededRandom random, int lockedPlayers)
    {
        var locks = new List<DrawLock>();
        while (locks.Count < DrawLimits.MaxLocks)
        {
            var candidate = Apart(Member(random.NextBelow(lockedPlayers) + 1), Member(random.NextBelow(lockedPlayers) + 1));
            if (candidate.First != candidate.Second && !locks.Any(existing => existing.SamePairAs(candidate)))
            {
                locks.Add(candidate);
            }
        }

        return [.. locks];
    }

    private static (DrawUnits Units, TeamLayout Layout) Draw(int players, int teamSize, DrawLock[] locks) =>
        (DrawUnits.From(Players([.. Enumerable.Repeat(Level, players)]), locks, teamSize).Value, TeamLayout.For(players, teamSize).Value);

    private static int[] Order(DrawUnits units) => [.. Enumerable.Range(0, units.Units.Length)];
}
