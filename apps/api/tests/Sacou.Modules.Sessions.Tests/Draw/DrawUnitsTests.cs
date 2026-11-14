using Sacou.Modules.Sessions.Domain.Draw;
using Xunit;
using static Sacou.Modules.Sessions.Tests.Draw.DrawFixture;

namespace Sacou.Modules.Sessions.Tests.Draw;

public sealed class DrawUnitsTests
{
    private static readonly int[] SixPlayers = [30, 35, 40, 45, 30, 35];

    [Fact]
    public void From_JoinsTogetherLocksTransitively()
    {
        var units = DrawUnits.From(Players(SixPlayers), [Together(Member(1), Member(3)), Together(Member(3), Member(5))], Indoor).Value;

        Assert.Equal([3, 1, 1, 1], units.Units.Select(unit => unit.Size));
        Assert.Equal([1, 3, 5], units.Units[0].Players.Select(player => player.Sequence));
        Assert.Equal(30 + 40 + 30, units.Units[0].SumTenths);
    }

    [Fact]
    public void From_GivesTheSameUnitsWhateverTheOrderOfTheLocks()
    {
        DrawLock[] locks = [Together(Member(6), Member(2)), Together(Member(4), Member(2)), Apart(Member(1), Member(4))];

        var forward = DrawUnits.From(Players(SixPlayers), locks, Indoor).Value;
        var backward = DrawUnits.From(Players(SixPlayers), [.. locks.Reverse()], Indoor).Value;

        Assert.Equal(
            forward.Units.Select(unit => string.Join(",", unit.Players.Select(player => player.Sequence))),
            backward.Units.Select(unit => string.Join(",", unit.Players.Select(player => player.Sequence))));
        Assert.True(forward.AreApart(0, 1) && backward.AreApart(1, 0));
    }

    [Fact]
    public void From_UnitBiggerThanTheTeam_IsTooLarge()
    {
        var result = DrawUnits.From(Players(30, 30, 30, 30), [Together(Member(1), Member(2)), Together(Member(2), Member(3))], BeachTwo);

        Assert.Equal(DrawErrors.LockTooLarge, result.Error);
    }

    [Fact]
    public void From_ApartInsideATogetherUnit_Conflicts()
    {
        var direct = DrawUnits.From(Players(SixPlayers), [Together(Member(1), Member(2)), Apart(Member(2), Member(1))], Indoor);
        var transitive = DrawUnits.From(
            Players(SixPlayers), [Together(Member(1), Member(2)), Together(Member(2), Member(3)), Apart(Member(1), Member(3))], Indoor);

        Assert.Equal(DrawErrors.LocksConflict, direct.Error);
        Assert.Equal(DrawErrors.LocksConflict, transitive.Error);
    }

    private static readonly Dictionary<string, DrawLock[]> InvalidLocks = new()
    {
        { "with oneself", [Together(Member(1), Member(1))] },
        { "with someone outside the teams", [Together(Member(1), Member(99))] },
        { "repeated", [Apart(Member(1), Member(2)), Apart(Member(2), Member(1))] },
        { "repeated together", [Together(Member(1), Member(2)), Together(Member(1), Member(2))] },
        { "more than 24", [.. Enumerable.Range(0, DrawLimits.MaxLocks + 1).Select(index => Apart(Member(1), Member(index + 2)))] },
    };

    public static TheoryData<string> InvalidLockRows => new(InvalidLocks.Keys);

    [Theory]
    [MemberData(nameof(InvalidLockRows))]
    public void From_InvalidLock_IsRefused(string row)
    {
        var locks = InvalidLocks[row];
        var players = Players([.. Enumerable.Repeat(30, DrawLimits.MaxLocks + 2)]);

        Assert.True(DrawUnits.From(players, locks, Indoor).Error == DrawErrors.LockInvalid, row);
    }

    [Fact]
    public void From_TwentyFourLocks_IsAccepted()
    {
        var players = Players([.. Enumerable.Repeat(30, DrawLimits.MaxLocks + 1)]);
        DrawLock[] locks = [.. Enumerable.Range(0, DrawLimits.MaxLocks).Select(index => Apart(Member(1), Member(index + 2)))];

        Assert.True(DrawUnits.From(players, locks, Indoor).IsSuccess);
    }
}
