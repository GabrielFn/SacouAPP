using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Matches.Contracts;
using Sacou.Modules.Sessions.Contracts;
using Sacou.Modules.Stats.GetMyStats;
using Sacou.Modules.Stats.Projections;
using Xunit;

namespace Sacou.Modules.Stats.Tests.GetMyStats;

/// <summary>Rule 3.7 and question 99 of E3.9: the sums of the card and the profile, from fresh projections only.</summary>
public sealed class PlayerTotalsTests
{
    private const int Season = 2026;

    private static readonly Guid Ana = Guid.Parse("00000000-0000-4000-8000-0000000000a1");
    private static readonly Guid Bia = Guid.Parse("00000000-0000-4000-8000-0000000000b1");
    private static readonly Guid AnaElsewhere = Guid.Parse("00000000-0000-4000-8000-0000000000a2");
    private static readonly DateTimeOffset Joined = new(2026, 3, 1, 12, 0, 0, TimeSpan.Zero);
    private static readonly SummaryRules Indoor = new(GameModality.Indoor6x6, MvpEnabled: true, MvpByStats: true, IndividualPoints: false);

    private static readonly MatchOutcome W = MatchOutcome.Win;
    private static readonly MatchOutcome L = MatchOutcome.Loss;
    private static readonly MatchOutcome U = MatchOutcome.Undecided;

    private int nextRound;

    [Fact]
    public void Sums_TheRoundsOfTheSeason_AndTheStreakRunsAcrossRounds()
    {
        var membership = Of(Ana, [Played(day: 10, [W, W], plusMinus: 5, mvp: true), Played(day: 17, [W, L, W], plusMinus: -1)]);

        var totals = PlayerTotals.Of(membership, Season);

        Assert.Equal(new SeasonTotals(MatchesPlayed: 5, Wins: 4, Losses: 1, PlusMinus: 4, LongestWinStreak: 3, MvpCount: 1, Rounds: 2, RoundsHeld: 2), totals);
    }

    [Fact]
    public void AMatchWithoutAWinner_BreaksTheStreak()
    {
        var membership = Of(Ana, [Played(day: 10, [W, W, U, W], plusMinus: 0)]);

        Assert.Equal(2, PlayerTotals.Of(membership, Season).LongestWinStreak);
    }

    /// <summary>Question 99, option 1: rounds held since joining, not before; a round the member sat out is held, not played.</summary>
    [Fact]
    public void Presence_IsRoundsPlayed_OverRoundsHeldWhileAMember()
    {
        var membership = Of(Ana, [
            Played(day: -20, [W], plusMinus: 1, member: Bia),
            Played(day: 10, [W], plusMinus: 1),
            Played(day: 17, [L], plusMinus: -1, member: Bia),
        ]);

        var totals = PlayerTotals.Of(membership, Season);

        Assert.Equal((1, 2), (totals.Rounds, totals.RoundsHeld));
    }

    [Fact]
    public void LeftMember_CountsNoRoundHeldAfterLeaving()
    {
        var membership = Of(Ana, [Played(day: 10, [W], plusMinus: 1), Played(day: 40, [W], plusMinus: 1, member: Bia)]);
        var left = membership with { Membership = membership.Membership with { Active = false, LeftAt = Joined.AddDays(20) } };

        Assert.Equal((1, 1), (PlayerTotals.Of(left, Season).Rounds, PlayerTotals.Of(left, Season).RoundsHeld));
    }

    /// <summary>Rule 3.6: a canceled round, a round with no finished match and another season count nowhere.</summary>
    [Fact]
    public void CanceledEmptyAndOtherSeasonRounds_CountNowhere()
    {
        var canceled = Played(day: 10, [W], plusMinus: 3);
        var membership = Of(Ana, [
            canceled with { Facts = canceled.Facts with { State = RoundState.Canceled } },
            Empty(day: 12),
            Played(day: 10, [W], plusMinus: 3, year: Season + 1),
        ]);

        Assert.Equal(SeasonTotals.None, PlayerTotals.Of(membership, Season));
    }

    [Fact]
    public void Person_SumsEveryGroup_AndTheStreakRunsAcrossGroupsInPlayOrder()
    {
        var first = Of(Ana, [Played(day: 10, [W, W], plusMinus: 2), Played(day: 24, [W], plusMinus: 1)]);
        var second = Of(AnaElsewhere, [Played(day: 17, [W, L], plusMinus: 0, member: AnaElsewhere, mvp: true)]);

        var totals = PlayerTotals.OfPerson([first, second], Season);

        Assert.Equal(new SeasonTotals(MatchesPlayed: 5, Wins: 4, Losses: 1, PlusMinus: 3, LongestWinStreak: 3, MvpCount: 1, Rounds: 3, RoundsHeld: 3), totals);
    }

    private static MembershipRounds Of(Guid memberId, IReadOnlyList<RoundProjection> rounds) =>
        new(new UserMembership(Guid.NewGuid(), "Racha", memberId, Active: true, Joined, LeftAt: null, GameModality.Indoor6x6), rounds);

    private RoundProjection Played(int day, MatchOutcome[] results, int plusMinus, Guid? member = null, bool mvp = false, int year = Season)
    {
        var memberId = member ?? Ana;
        var startsAt = new DateTimeOffset(year, 3, 1, 23, 0, 0, TimeSpan.Zero).AddDays(day);
        var player = new PlayerSummary(
            memberId,
            results.Length,
            results.Count(result => result == W),
            results.Count(result => result == L),
            results.Count(result => result == U),
            0,
            0,
            plusMinus,
            0,
            0,
            results,
            new PointsByKindSummary(0, 0, 0, 0),
            CourtSide.A);
        var matches = results.Select(_ => new FinishedMatchSummary(Guid.NewGuid(), CourtSide.A, [memberId], [], [memberId], [], 1, 0)).ToList();
        var summary = new SessionSummary(
            1, matches, [player], new SideHighlightsSummary(null, null), mvp ? new MvpSummary(MvpKind.Player, [memberId], CourtSide.A, 1, 1, 1, 1) : null, null);
        return Round(startsAt, summary);
    }

    private RoundProjection Empty(int day) => Round(new DateTimeOffset(Season, 3, 1, 23, 0, 0, TimeSpan.Zero).AddDays(day), SessionSummary.Empty);

    private RoundProjection Round(DateTimeOffset startsAt, SessionSummary summary)
    {
        var roundId = new Guid(nextRound++, 0, 0, new byte[8]);
        var facts = new RoundFacts(roundId, RoundState.Scheduled, startsAt, DateOnly.FromDateTime(startsAt.UtcDateTime), Indoor);
        return new RoundProjection(facts, new CourtStreamHead(roundId, Guid.NewGuid(), 4), 4, "hash", summary);
    }
}
