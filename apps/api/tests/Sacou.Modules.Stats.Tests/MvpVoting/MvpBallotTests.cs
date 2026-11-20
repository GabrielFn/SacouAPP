using Sacou.Modules.Stats.Domain.MvpVoting;
using Sacou.Shared.Members;
using Xunit;

namespace Sacou.Modules.Stats.Tests.MvpVoting;

/// <summary>J1 to J4 of the window and E2 to E8 of the eligibility, in the domain (ADR 0072, D2 and D4).</summary>
public sealed class MvpBallotTests
{
    private static readonly DateTimeOffset EndsAt = new(2026, 11, 21, 1, 0, 0, TimeSpan.Zero);
    private static readonly MemberId Ana = new(Guid.Parse("00000000-0000-4000-8000-0000000000a1"));
    private static readonly MemberId Bia = new(Guid.Parse("00000000-0000-4000-8000-0000000000b1"));
    private static readonly MemberId Caio = new(Guid.Parse("00000000-0000-4000-8000-0000000000c1"));
    private static readonly MemberId Davi = new(Guid.Parse("00000000-0000-4000-8000-0000000000d1"));

    private static readonly MvpVotingWindow Window = MvpVotingWindow.From(EndsAt);

    private static DateTimeOffset Open => EndsAt.AddHours(1);

    [Fact]
    public void Window_ClosesTwentyFourHoursAfterTheEnd() =>
        Assert.Equal(EndsAt.AddHours(MvpVotingWindow.OpenHours), Window.ClosesAt);

    [Fact]
    public void J1_ATickBeforeTheEnd_IsNotOpen() =>
        Assert.Equal(MvpVotingState.NotOpen, Window.StateAt(EndsAt.AddTicks(-1)));

    [Fact]
    public void J2_AtTheEnd_IsOpen() =>
        Assert.Equal(MvpVotingState.Open, Window.StateAt(EndsAt));

    [Fact]
    public void J3_ATickBeforeTheClose_IsOpen() =>
        Assert.Equal(MvpVotingState.Open, Window.StateAt(Window.ClosesAt.AddTicks(-1)));

    [Fact]
    public void J4_AtTheVeryClose_IsClosed() =>
        Assert.Equal(MvpVotingState.Closed, Window.StateAt(Window.ClosesAt));

    /// <summary>The night of a change of hour does not move the 24 h: the window is counted in instants.</summary>
    [Fact]
    public void J6_AnOffsetChangeInBetween_KeepsTwentyFourHoursOfInstants()
    {
        var endsInSaoPaulo = new DateTimeOffset(2026, 10, 31, 23, 0, 0, TimeSpan.FromHours(-3));

        var window = MvpVotingWindow.From(endsInSaoPaulo);

        Assert.Equal(TimeSpan.FromHours(MvpVotingWindow.OpenHours), window.ClosesAt - window.OpensAt);
    }

    [Fact]
    public void E1_AVoteForWhoPlayed_IsCast()
    {
        var vote = Ballot().Cast(Ana, Bia, alreadyVoted: false, Open);

        Assert.True(vote.IsSuccess);
        Assert.Equal(new MvpVote(Ana, Bia, Open), vote.Value);
    }

    [Fact]
    public void E2_AVoteForOneself_IsRefused() =>
        Assert.Equal(MvpVotingErrors.SelfVote, Ballot().Cast(Ana, Ana, alreadyVoted: false, Open).Error);

    [Fact]
    public void E3_AVoterWhoDidNotPlay_IsNotEligible()
    {
        Assert.Equal(MvpVotingErrors.VoterNotEligible, Ballot().Cast(Davi, Bia, alreadyVoted: false, Open).Error);
        Assert.Equal(MvpVotingErrors.VoterNotEligible, Ballot().RefusalFor(Davi, alreadyVoted: false, Open));
    }

    /// <summary>Caio is in the after-game only with a match still open: no finished match, so nobody's vote nor candidate.</summary>
    [Fact]
    public void E3_OnlyAnOpenMatch_IsNotHavingPlayed()
    {
        Assert.Equal(MvpVotingErrors.VoterNotEligible, Ballot().Cast(Caio, Bia, alreadyVoted: false, Open).Error);
        Assert.Equal(MvpVotingErrors.CandidateInvalid, Ballot().Cast(Ana, Caio, alreadyVoted: false, Open).Error);
    }

    [Fact]
    public void E4_E5_ACandidateWhoDidNotPlayOrDoesNotExist_IsTheSameRefusal()
    {
        Assert.Equal(MvpVotingErrors.CandidateInvalid, Ballot().Cast(Ana, Davi, alreadyVoted: false, Open).Error);
        Assert.Equal(MvpVotingErrors.CandidateInvalid, Ballot().Cast(Ana, new MemberId(Guid.NewGuid()), alreadyVoted: false, Open).Error);
    }

    [Fact]
    public void E7_BeforeTheEnd_IsNotOpen() =>
        Assert.Equal(MvpVotingErrors.NotOpen, Ballot().Cast(Ana, Bia, alreadyVoted: false, EndsAt.AddTicks(-1)).Error);

    [Fact]
    public void E8_AfterTheTwentyFourHours_IsClosed() =>
        Assert.Equal(MvpVotingErrors.Closed, Ballot().Cast(Ana, Bia, alreadyVoted: false, Window.ClosesAt).Error);

    [Fact]
    public void ASecondVote_IsRefused_AndSoIsTheBallot()
    {
        Assert.Equal(MvpVotingErrors.AlreadyVoted, Ballot().Cast(Ana, Bia, alreadyVoted: true, Open).Error);
        Assert.Equal(MvpVotingErrors.AlreadyVoted, Ballot().RefusalFor(Ana, alreadyVoted: true, Open));
    }

    /// <summary>The window speaks first: a vote after the close is "closed", even from someone who already voted.</summary>
    [Fact]
    public void TheWindow_IsCheckedBeforeEverythingElse() =>
        Assert.Equal(MvpVotingErrors.Closed, Ballot().Cast(Davi, Davi, alreadyVoted: true, Window.ClosesAt).Error);

    [Fact]
    public void TheBallot_ListsWhoPlayed_ButTheVoter() =>
        Assert.Equal([Bia], Ballot().CandidatesFor(Ana).Select(candidate => candidate.MemberId));

    [Fact]
    public void AVoteToText_NeverHasThePair() =>
        Assert.Equal(nameof(MvpVote), new MvpVote(Ana, Bia, Open).ToString());

    private static MvpBallot Ballot() => MvpBallot.Of(Window,
    [
        new MvpCandidate(Ana, MatchesPlayed: 3, Wins: 2, PlusMinus: 5),
        new MvpCandidate(Bia, MatchesPlayed: 2, Wins: 1, PlusMinus: -1),
        new MvpCandidate(Caio, MatchesPlayed: 0, Wins: 0, PlusMinus: 0),
    ]);
}

/// <summary>Literal edges of the window, so a changed constant or a closed interval is caught.</summary>
public sealed class MvpWindowLiteralTests
{
    private static readonly DateTimeOffset EndsAt = new(2026, 11, 21, 1, 0, 0, TimeSpan.Zero);

    [Fact]
    public void TheWindow_IsOpenForLiteralTwentyFourHours()
    {
        var window = MvpVotingWindow.From(EndsAt);

        Assert.Equal(new DateTimeOffset(2026, 11, 22, 1, 0, 0, TimeSpan.Zero), window.ClosesAt);
        Assert.Equal(MvpVotingState.Open, window.StateAt(new DateTimeOffset(2026, 11, 22, 0, 59, 59, TimeSpan.Zero)));
        Assert.Equal(MvpVotingState.Closed, window.StateAt(new DateTimeOffset(2026, 11, 22, 1, 0, 0, TimeSpan.Zero)));
        Assert.Equal(MvpVotingState.NotOpen, window.StateAt(new DateTimeOffset(2026, 11, 21, 0, 59, 59, TimeSpan.Zero)));
    }
}
