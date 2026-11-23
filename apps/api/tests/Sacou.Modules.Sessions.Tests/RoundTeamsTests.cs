using System.Collections.Immutable;
using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Shared.Members;
using Xunit;
using static Sacou.Modules.Sessions.Tests.RoundFixture;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>The published teams (ADR 0078): cases 1 to 8 of the R100 plan, on group G1 of docs/dominio/sorteio.md.</summary>
public sealed class RoundTeamsTests
{
    private const int Indoor = 6;
    private const int BeachTwo = 2;
    private const int Capacity = 30;
    private const int Waiting = 31;
    private const int NotGoing = 32;
    private const int LeftGroup = 33;

    private static readonly DateTimeOffset Later = Now.AddHours(1);

    /// <summary>G1: 14 confirmed (1..14), one going who left the group (33), and, with a full round of 15, one waiting (31) and one "não vou" (32).</summary>
    private static (Round Round, IReadOnlySet<MemberId> Active) G1()
    {
        var rules = Rules(capacity: 15);
        var round = Going(NewRound(), rules, 14);
        round = Answer(round, rules, LeftGroup, AttendanceResponse.Going);
        round = Answer(round, rules, Waiting, AttendanceResponse.Going);
        round = Answer(round, rules, NotGoing, AttendanceResponse.NotGoing);
        var active = Enumerable.Range(1, 14).Concat([Waiting, NotGoing]).Select(Member).ToHashSet();
        return (round, active);
    }

    private static ImmutableArray<MemberId> Ids(params int[] members) => [.. members.Select(Member)];

    private static ImmutableArray<ImmutableArray<MemberId>> Teams(params int[][] teams) => [.. teams.Select(team => Ids(team))];

    private static readonly int[] Orange = [1, 2, 3, 4, 5, 6];
    private static readonly int[] Blue = [7, 8, 9, 10, 11, 12];

    private static Sacou.Shared.Results.Result<RoundChange> Confirm(
        Round round, IReadOnlySet<MemberId> active, ImmutableArray<ImmutableArray<MemberId>> teams, ImmutableArray<MemberId> reserves,
        int playersPerTeam = Indoor, DateTimeOffset? now = null) =>
        round.ConfirmTeams(teams, reserves, active, playersPerTeam, now ?? Now);

    [Fact]
    public void Case1_G1_TwoTeamsOfSixAndTwoReserves_AreStoredInOrder()
    {
        var (round, active) = G1();

        var confirmed = Confirm(round, active, Teams(Orange, Blue), Ids(13, 14)).Value;

        var teams = Assert.IsType<RoundTeams>(confirmed.Round.Teams);
        Assert.Equal(Ids(Orange), teams.Teams[0]);
        Assert.Equal(Ids(Blue), teams.Teams[1]);
        Assert.Equal(Ids(13, 14), teams.Reserves);
        Assert.Equal(Now, teams.ConfirmedAt);
        Assert.True(confirmed.TeamsChanged);
        Assert.Equal(nameof(RoundTeams), teams.ToString());
    }

    [Fact]
    public void Case2_SomeoneTwice_IsInvalid()
    {
        var (round, active) = G1();

        AssertInvalid(Confirm(round, active, Teams([1, 2, 3, 4, 5, 6], [6, 8, 9, 10, 11, 12]), Ids(13, 14)));
        AssertInvalid(Confirm(round, active, Teams(Orange, Blue), Ids(12, 13)));
    }

    [Theory]
    [InlineData(Waiting)]
    [InlineData(NotGoing)]
    [InlineData(LeftGroup)]
    [InlineData(99)]
    public void Case3_SomeoneNotConfirmedOrNotActive_IsInvalid(int stranger)
    {
        var (round, active) = G1();

        AssertInvalid(Confirm(round, active, Teams(Orange, [7, 8, 9, 10, 11, stranger]), Ids(13, 14)));
        AssertInvalid(Confirm(round, active, Teams(Orange, Blue), Ids(13, stranger)));
    }

    public static TheoryData<int[][], int> BadShapes => new()
    {
        { [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11]], Indoor },
        { [[1, 2, 3, 4, 5, 6]], Indoor },
        { [[1, 2, 3, 4, 5, 6, 7], [8, 9, 10, 11, 12, 13, 14]], Indoor },
        { [[1, 2, 3], [4, 5, 6]], BeachTwo },
        { [[1], [2]], Indoor },
        { [[], []], Indoor },
        { [], Indoor },
    };

    [Theory]
    [MemberData(nameof(BadShapes))]
    public void Case4_BadShapes_AreInvalid(int[][] teams, int playersPerTeam)
    {
        var (round, active) = G1();

        AssertInvalid(Confirm(round, active, Teams(teams), [], playersPerTeam));
    }

    [Fact]
    public void Case4_NineTeams_AreValidWhenEveryoneIsConfirmed_ButNotWithAStranger()
    {
        var rules = Rules(capacity: Capacity);
        var round = Going(NewRound(), rules, 18);
        var active = Enumerable.Range(1, 18).Select(Member).ToHashSet();
        var nine = Enumerable.Range(0, 9).Select(team => new[] { (team * 2) + 1, (team * 2) + 2 }).ToArray();

        Assert.True(Confirm(round, active, Teams(nine), [], BeachTwo).IsSuccess);
    }

    [Fact]
    public void Case5_SmallerTeamsThanTheModality_AreValid()
    {
        var rules = Rules(capacity: Capacity);
        var ten = Going(NewRound(), rules, 10);
        var tenActive = Enumerable.Range(1, 10).Select(Member).ToHashSet();
        Assert.True(Confirm(ten, tenActive, Teams([1, 2, 3, 4, 5], [6, 7, 8, 9, 10]), []).IsSuccess);

        var nine = Going(NewRound(), rules, 9);
        var nineActive = Enumerable.Range(1, 9).Select(Member).ToHashSet();
        Assert.True(Confirm(nine, nineActive, Teams([1, 2], [3, 4], [5, 6], [7, 8]), Ids(9), BeachTwo).IsSuccess);
    }

    [Fact]
    public void Case6_NoReserves_IsValid_AndAMissingList_IsInvalid()
    {
        var (round, active) = G1();

        Assert.True(Confirm(round, active, Teams(Orange, Blue), []).IsSuccess);
        AssertInvalid(Confirm(round, active, Teams(Orange, Blue), default));
        AssertInvalid(Confirm(round, active, default, Ids(13, 14)));
    }

    [Fact]
    public void Case7_ACancelledOrClosedRound_RefusesTheTeams()
    {
        var (round, active) = G1();
        var canceled = round.Cancel().Round;
        var closed = round.Close(round.Slot.StartsAt.AddMinutes(30), hasFinishedMatch: false).Value.Round;

        Assert.Equal(RoundErrors.RoundClosed, Confirm(canceled, active, Teams(Orange, Blue), []).Error);
        Assert.Equal(RoundErrors.RoundClosed, Confirm(closed, active, Teams(Orange, Blue), [], now: closed.EndsAt.AddMinutes(1)).Error);
    }

    [Fact]
    public void Case7_AfterTheStart_TheTeamsGoThrough_UntilTheVeryEnd()
    {
        var (round, active) = G1();

        Assert.True(Confirm(round, active, Teams(Orange, Blue), [], now: round.Slot.StartsAt.AddMinutes(5)).IsSuccess);
        Assert.True(Confirm(round, active, Teams(Orange, Blue), [], now: round.EndsAt.AddTicks(-1)).IsSuccess);
        Assert.Equal(RoundErrors.RoundClosed, Confirm(round, active, Teams(Orange, Blue), [], now: round.EndsAt).Error);
    }

    [Fact]
    public void Case8_ASecondConfirmation_ReplacesTheFirstWhole_WithAnEventOfIdsOnly()
    {
        var (round, active) = G1();
        var first = Confirm(round, active, Teams(Orange, Blue), Ids(13, 14)).Value.Round;

        var second = Confirm(first, active, Teams([1, 3, 5, 7, 9, 11], [2, 4, 6, 8, 10, 12]), [], now: Later).Value;

        var teams = Assert.IsType<RoundTeams>(second.Round.Teams);
        Assert.Equal(Ids(1, 3, 5, 7, 9, 11), teams.Teams[0]);
        Assert.Empty(teams.Reserves);
        Assert.Equal(Later, teams.ConfirmedAt);
        Assert.Equal(new RoundTeamsConfirmed(round.Id, round.GroupId), Assert.Single(second.Events));
    }

    private static void AssertInvalid(Sacou.Shared.Results.Result<RoundChange> result) =>
        Assert.Equal(RoundErrors.RoundTeamsInvalid, result.Error);
}
