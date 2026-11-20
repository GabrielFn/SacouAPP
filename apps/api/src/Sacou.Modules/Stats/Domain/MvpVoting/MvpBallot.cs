using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Stats.Domain.MvpVoting;

/// <summary>
/// A member of the round's after-game with the numbers the count reads. Only a member with a finished match is on the
/// ballot (D3).
/// </summary>
internal sealed record MvpCandidate(MemberId MemberId, int MatchesPlayed, int Wins, int PlusMinus);

/// <summary>A vote as stored: who voted, for whom, when. Only ids (ADR 0012).</summary>
internal sealed record MvpVote(MemberId Voter, MemberId Candidate, DateTimeOffset CastAt)
{
    /// <summary>Never the pair: a vote does not go to a log (ADR 0072, D7).</summary>
    public override string ToString() => nameof(MvpVote);
}

/// <summary>
/// Who may vote for whom in a round with the vote on (ADR 0072, D4): the window is open, the voter played, the
/// candidate played and is not the voter, and the voter has not voted yet. "Played" is having a finished match in the
/// projection of the round (D3). The membership, the round and the setting are checked before, by the slice.
/// </summary>
internal sealed record MvpBallot
{
    private MvpBallot(MvpVotingWindow window, IReadOnlyList<MvpCandidate> players)
    {
        Window = window;
        Players = players;
    }

    public MvpVotingWindow Window { get; }

    /// <summary>Everyone with a finished match in the round, in the order of the after-game.</summary>
    public IReadOnlyList<MvpCandidate> Players { get; }

    /// <summary>Only who played a finished match counts: a match still open makes nobody eligible.</summary>
    public static MvpBallot Of(MvpVotingWindow window, IEnumerable<MvpCandidate> players) =>
        new(window, [.. players.Where(player => player.MatchesPlayed > 0)]);

    public bool HasPlayed(MemberId member) => Players.Any(player => player.MemberId == member);

    /// <summary>Why <paramref name="voter"/> cannot vote now, whoever the candidate, or null when they can.</summary>
    public Error? RefusalFor(MemberId voter, bool alreadyVoted, DateTimeOffset now) => Window.StateAt(now) switch
    {
        MvpVotingState.NotOpen => MvpVotingErrors.NotOpen,
        MvpVotingState.Closed => MvpVotingErrors.Closed,
        _ when !HasPlayed(voter) => MvpVotingErrors.VoterNotEligible,
        _ when alreadyVoted => MvpVotingErrors.AlreadyVoted,
        _ => null,
    };

    /// <summary>The vote to store, or why not, in the order of D4. A second vote is also refused by the store's key (D9).</summary>
    public Result<MvpVote> Cast(MemberId voter, MemberId candidate, bool alreadyVoted, DateTimeOffset now)
    {
        if (RefusalFor(voter, alreadyVoted: false, now) is { } refusal)
        {
            return Result.Failure<MvpVote>(refusal);
        }

        if (candidate == voter)
        {
            return Result.Failure<MvpVote>(MvpVotingErrors.SelfVote);
        }

        if (!HasPlayed(candidate))
        {
            return Result.Failure<MvpVote>(MvpVotingErrors.CandidateInvalid);
        }

        return alreadyVoted ? Result.Failure<MvpVote>(MvpVotingErrors.AlreadyVoted) : Result.Success(new MvpVote(voter, candidate, now));
    }

    /// <summary>The ballot as <paramref name="voter"/> sees it: everyone who played but themselves.</summary>
    public IReadOnlyList<MvpCandidate> CandidatesFor(MemberId voter) => [.. Players.Where(player => player.MemberId != voter)];
}
