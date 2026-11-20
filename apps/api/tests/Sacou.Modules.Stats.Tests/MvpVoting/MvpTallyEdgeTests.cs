using Sacou.Modules.Stats.Domain.MvpVoting;
using Sacou.Shared.Members;
using Xunit;

namespace Sacou.Modules.Stats.Tests.MvpVoting;

/// <summary>Order of the tie-break (votes, balance, wins, shared) and the ballot of who did not play.</summary>
public sealed class MvpTallyEdgeTests
{
    private static readonly DateTimeOffset At = new(2026, 11, 21, 2, 0, 0, TimeSpan.Zero);
    private static MemberId M(int n) => new(Guid.Parse($"00000000-0000-4000-8000-0000000000{n:x2}"));

    private static MvpVote V(int voter, int candidate) => new(M(voter), M(candidate), At);

    [Fact]
    public void Balance_BeatsWins_WhenVotesTie()
    {
        var players = new[] { new MvpCandidate(M(1), 3, Wins: 5, PlusMinus: 1), new MvpCandidate(M(2), 3, Wins: 1, PlusMinus: 9) };

        var result = MvpTally.Count([V(3, 1), V(4, 2)], players);

        Assert.Equal([M(2)], result.Winners);
    }

    [Fact]
    public void Wins_Decide_WhenVotesAndBalanceTie()
    {
        var players = new[] { new MvpCandidate(M(1), 3, Wins: 2, PlusMinus: 4), new MvpCandidate(M(2), 3, Wins: 3, PlusMinus: 4) };

        Assert.Equal([M(2)], MvpTally.Count([V(3, 1), V(4, 2)], players).Winners);
    }

    [Fact]
    public void Votes_BeatBalanceAndWins()
    {
        var players = new[] { new MvpCandidate(M(1), 3, Wins: 0, PlusMinus: -9), new MvpCandidate(M(2), 3, Wins: 9, PlusMinus: 9) };

        Assert.Equal([M(1)], MvpTally.Count([V(3, 1), V(4, 1), V(5, 2)], players).Winners);
    }

    [Fact]
    public void TiedOnEverything_IsASharedMvp()
    {
        var players = new[] { new MvpCandidate(M(1), 3, 2, 4), new MvpCandidate(M(2), 3, 2, 4) };

        var result = MvpTally.Count([V(3, 2), V(4, 1)], players);

        Assert.Equal([M(1), M(2)], result.Winners);
        Assert.Equal(2, result.Voters);
    }

    [Fact]
    public void AVoteForWhoDidNotPlay_IsDropped_ButCountsAsVoter()
    {
        var players = new[] { new MvpCandidate(M(1), 3, 2, 4), new MvpCandidate(M(2), 0, 0, 0) };

        var result = MvpTally.Count([V(3, 2), V(4, 2)], players);

        Assert.Empty(result.Winners);
        Assert.Equal(2, result.Voters);
    }

    [Fact]
    public void TheBallot_OfSomeoneWhoDidNotPlay_ListsThePlayersAndIsRefusedTheVote()
    {
        var window = MvpVotingWindow.From(At);
        var ballot = MvpBallot.Of(window, [new MvpCandidate(M(1), 2, 1, 1), new MvpCandidate(M(2), 0, 0, 0)]);

        Assert.False(ballot.HasPlayed(M(9)));
        Assert.Equal(MvpVotingErrors.VoterNotEligible, ballot.RefusalFor(M(9), false, At.AddHours(1)));
        Assert.Equal(MvpVotingErrors.VoterNotEligible, ballot.Cast(M(9), M(1), false, At.AddHours(1)).Error);
        Assert.Equal(MvpVotingErrors.CandidateInvalid, ballot.Cast(M(1), M(2), false, At.AddHours(1)).Error);
        Assert.Equal(MvpVotingErrors.SelfVote, ballot.Cast(M(1), M(1), false, At.AddHours(1)).Error);
    }
}
