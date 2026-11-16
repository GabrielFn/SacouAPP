using System.Collections.Immutable;
using Sacou.Modules.Sessions.Domain.Draw;
using Sacou.Shared.Members;
using Xunit;
using static Sacou.Modules.Sessions.Tests.Draw.DrawFixture;

namespace Sacou.Modules.Sessions.Tests.Draw;

/// <summary>
/// Golden cases of the draw (plan E3.6, section 4), written by hand. Server side only (ADR 0055, D1), so they live
/// here, as the <c>MemberLevelResolver</c> table does. They fix the gap, the locks, the reserves and the layout,
/// never who lands on which team (but for the locked pair), so a better search never breaks them.
/// </summary>
public sealed class TeamDrawGoldenTests
{
    private static readonly string[] TheLastTwo = ["Davi", "Sofia"];

    [Fact]
    public void G1_ScreenSeven_BalancesToAGapOfOneTenth()
    {
        var result = TeamDraw.Run(ScreenSevenInput()).Value;

        Assert.Equal(Indoor, result.TeamSize);
        Assert.Equal(2, result.Teams.Length);
        Assert.Equal([Named("Davi"), Named("Sofia")], result.Reserves.Select(player => player.MemberId));
        Assert.Equal(TeamOf(result, Named("Ana")), TeamOf(result, Named("João")));
        Assert.Equal([220, 225], Sums(result));
        Assert.Equal([37, 38], result.Teams.Select(team => team.AverageTenths).Order());
        Assert.Equal(1, result.DifferenceTenths);
        Assert.Equal(Seed, result.Seed);
    }

    [Fact]
    public void G1_TeamsAreNumberedFromOneWithMembersInOrderOfArrival()
    {
        var result = TeamDraw.Run(ScreenSevenInput()).Value;

        Assert.Equal([1, 2], result.Teams.Select(team => team.Number));
        Assert.Contains(result.Teams[0].Members, player => player.MemberId == Named("Ana"));
        Assert.All(result.Teams, team => Assert.Equal(team.Members.OrderBy(player => player.Sequence), team.Members));
    }

    [Fact]
    public void G2_EveryoneAtThree_HasNoGap()
    {
        var result = TeamDraw.Run(Input(Players([.. Enumerable.Repeat(30, 12)]), Indoor)).Value;

        Assert.Equal(0, result.DifferenceTenths);
        Assert.All(result.Teams, team => Assert.Equal(30, team.AverageTenths));
    }

    [Fact]
    public void G3_BeachTwo_WithoutLocks_PairsTheExtremes()
    {
        var result = TeamDraw.Run(Input(Players(50, 10, 30, 30), BeachTwo)).Value;

        Assert.Equal("1,2 | 3,4", SplitKey(result));
        Assert.Equal(0, result.DifferenceTenths);
    }

    [Fact]
    public void G3_BeachTwo_ApartTheMiddle_CostsTwoPoints()
    {
        var result = TeamDraw.Run(Input(Players(50, 10, 30, 30), BeachTwo, [Apart(Member(3), Member(4))])).Value;

        Assert.NotEqual(TeamOf(result, Member(3)), TeamOf(result, Member(4)));
        Assert.Equal(20, result.DifferenceTenths);
    }

    [Fact]
    public void G3_BeachTwo_TogetherStrongAndMiddle_CostsTwoPoints()
    {
        var result = TeamDraw.Run(Input(Players(50, 10, 30, 30), BeachTwo, [Together(Member(1), Member(3))])).Value;

        Assert.Equal("1,3 | 2,4", SplitKey(result));
        Assert.Equal(20, result.DifferenceTenths);
    }

    [Fact]
    public void G4_BeachTwoWithNine_FourPairsAndTheLastAsReserve()
    {
        var players = Players(50, 10, 45, 20, 35, 30, 40, 15, 25);

        const int pairs = 4;
        var lastToArrive = Member(players.Length);

        var result = TeamDraw.Run(Input(players, BeachTwo)).Value;

        Assert.Equal(pairs, result.Teams.Length);
        Assert.Equal([lastToArrive], result.Reserves.Select(player => player.MemberId));
        Assert.Equal(DrawOracle.BestSumGap(players[..^1], [], pairs, BeachTwo), SumGap(result));
    }

    [Fact]
    public void G5_BeachFourWithTwelve_ThreeTeamsAsTheOracle()
    {
        var players = Players(50, 45, 45, 40, 35, 35, 30, 30, 25, 20, 15, 10);

        const int teams = 3;

        var result = TeamDraw.Run(Input(players, BeachFour)).Value;

        Assert.Equal(teams, result.Teams.Length);
        Assert.Empty(result.Reserves);
        Assert.Equal(DrawOracle.BestSumGap(players, [], teams, BeachFour), SumGap(result));
    }

    [Theory]
    [InlineData(10, 5, 0)]
    [InlineData(11, 5, 1)]
    [InlineData(13, 6, 1)]
    public void G6_FewerThanTwoFullTeams_PlayHalvesAndTheLastWaits(int count, int teamSize, int reserves)
    {
        var players = Players([.. Enumerable.Range(0, count).Select(index => 30 + (5 * (index % 3)))]);

        var result = TeamDraw.Run(Input(players, Indoor)).Value;

        Assert.Equal(teamSize, result.TeamSize);
        Assert.All(result.Teams, team => Assert.Equal(teamSize, team.Members.Length));
        Assert.Equal(players[(count - reserves)..].Select(player => player.MemberId), result.Reserves.Select(player => player.MemberId));
    }

    [Fact]
    public void G6_ThreePlayers_AreNotEnough()
    {
        Assert.Equal(DrawErrors.NotEnoughPlayers, TeamDraw.Run(Input(Players(30, 30, 30), Indoor)).Error);
    }

    [Fact]
    public void G8_ExplicitReserves_SitOutInTheOrderSent()
    {
        var result = TeamDraw.Run(ScreenSevenInput(reserves: [Named("Marcos"), Named("Bia")])).Value;

        Assert.Equal([Named("Marcos"), Named("Bia")], result.Reserves.Select(player => player.MemberId));
        Assert.All(TheLastTwo, name => TeamOf(result, Named(name)));
        Assert.Equal(TeamOf(result, Named("Ana")), TeamOf(result, Named("João")));
    }

    public static readonly TheoryData<string, MemberId[]> InvalidReserves = new()
    {
        { "only one", [Named("Marcos")] },
        { "three", [Named("Marcos"), Named("Bia"), Named("Lia")] },
        { "repeated", [Named("Marcos"), Named("Marcos")] },
        { "not confirmed", [Named("Marcos"), Member(99)] },
    };

    [Theory]
    [MemberData(nameof(InvalidReserves))]
    public void G8_InvalidReserves_AreRefused(string row, MemberId[] reserves)
    {
        Assert.True(TeamDraw.Run(ScreenSevenInput(reserves: [.. reserves])).Error == DrawErrors.ReservesInvalid, row);
    }

    [Fact]
    public void G9_ThreeTogetherInBeachTwo_IsTooLarge()
    {
        var input = Input(Players(30, 30, 30, 30), BeachTwo, [Together(Member(1), Member(2)), Together(Member(2), Member(3))]);

        Assert.Equal(DrawErrors.LockTooLarge, TeamDraw.Run(input).Error);
    }

    [Fact]
    public void G9_TogetherAndApart_Conflict()
    {
        var input = Input(Players(30, 30, 30, 30), BeachTwo, [Together(Member(1), Member(2)), Apart(Member(1), Member(2))]);

        Assert.Equal(DrawErrors.LocksConflict, TeamDraw.Run(input).Error);
    }

    [Fact]
    public void G9_ThreeApartOnTwoTeams_IsUnsatisfiable()
    {
        ImmutableArray<DrawLock> locks = [Apart(Member(1), Member(2)), Apart(Member(2), Member(3)), Apart(Member(1), Member(3))];

        Assert.Equal(DrawErrors.LocksUnsatisfiable, TeamDraw.Run(Input(Players(30, 30, 30, 30), BeachTwo, locks)).Error);
        Assert.Equal(DrawErrors.LocksUnsatisfiable, TeamDraw.Run(Input(Players(30, 30, 30, 30), BeachTwo, locks, balance: false)).Error);
    }

    [Fact]
    public void G9_UnsatisfiableOnTheLocalSearch_IsReported()
    {
        var players = Players([.. Enumerable.Repeat(30, 18)]);
        ImmutableArray<DrawLock> locks =
        [
            Apart(Member(1), Member(2)), Apart(Member(1), Member(3)), Apart(Member(1), Member(4)),
            Apart(Member(2), Member(3)), Apart(Member(2), Member(4)), Apart(Member(3), Member(4)),
        ];

        Assert.Equal(DrawErrors.LocksUnsatisfiable, TeamDraw.Run(Input(players, Indoor, locks)).Error);
    }

    private static readonly Dictionary<string, DrawLock[]> InvalidLocks = new()
    {
        { "with a reserve", [Together(Named("Ana"), Named("Davi"))] },
        { "with someone who said no", [Together(Named("Ana"), Member(99))] },
        { "with oneself", [Together(Named("Ana"), Named("Ana"))] },
        { "repeated", [Together(Named("Ana"), Named("João")), Together(Named("João"), Named("Ana"))] },
        {
            "25 locks",
            [.. Enumerable.Range(0, DrawLimits.MaxLocks + 1).Select(index => Apart(Member(1 + (index % 12)), Member(1 + ((index + 1) % 12))))]
        },
    };

    public static TheoryData<string> InvalidLockRows => new(InvalidLocks.Keys);

    [Theory]
    [MemberData(nameof(InvalidLockRows))]
    public void G9_InvalidLocks_AreRefused(string row)
    {
        var locks = InvalidLocks[row];
        var input = Input(ScreenSevenPlayers(), Indoor, [.. locks]);

        Assert.True(TeamDraw.Run(input).Error == DrawErrors.LockInvalid, row);
    }

    [Fact]
    public void G10_QuickDraw_RepeatsWithTheSeedAndKeepsTheLock()
    {
        var first = TeamDraw.Run(ScreenSevenInput(balance: false)).Value;
        var second = TeamDraw.Run(ScreenSevenInput(balance: false)).Value;

        Assert.Equal(SplitKey(first), SplitKey(second));
        Assert.Equal(TeamOf(first, Named("Ana")), TeamOf(first, Named("João")));
        Assert.Equal([Named("Davi"), Named("Sofia")], first.Reserves.Select(player => player.MemberId));
        Assert.All(first.Teams, team => Assert.Equal(Indoor, team.Members.Length));
    }

    [Fact]
    public void G10_QuickDraw_ChangesWithTheSeed()
    {
        var splits = Enumerable.Range(1, 10)
            .Select(seed => SplitKey(TeamDraw.Run(ScreenSevenInput(seed: (ulong)seed, balance: false)).Value))
            .ToHashSet();

        Assert.True(splits.Count > 1);
    }
}
