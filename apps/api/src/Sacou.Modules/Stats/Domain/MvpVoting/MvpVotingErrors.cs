using Sacou.Shared.Results;

namespace Sacou.Modules.Stats.Domain.MvpVoting;

/// <summary>
/// Stable codes of the MVP vote (ADR 0072), listed in docs/dominio/mvp.md. None of them echoes a candidate: a refusal
/// never says whom someone tried to vote for.
/// </summary>
internal static class MvpVotingErrors
{
    /// <summary><c>mvp.enabled</c> or <c>mvp.voting</c> is off for this round.</summary>
    public static readonly Error VotingOff = new("stats.mvp-voting-off", ErrorKind.NotFound);

    public static readonly Error NotOpen = new("stats.mvp-voting-not-open", ErrorKind.Unprocessable);

    public static readonly Error Closed = new("stats.mvp-voting-closed", ErrorKind.Unprocessable);

    /// <summary>The caller did not play a finished match of the round.</summary>
    public static readonly Error VoterNotEligible = new("stats.mvp-voter-not-eligible", ErrorKind.Forbidden);

    /// <summary>One code for a candidate who did not play, is not of the group or does not exist: it never says which.</summary>
    public static readonly Error CandidateInvalid = new("stats.mvp-candidate-invalid", ErrorKind.Unprocessable);

    public static readonly Error SelfVote = new("stats.mvp-self-vote", ErrorKind.Unprocessable);

    /// <summary>The vote is final (question 145): a second one is refused, never replaces the first.</summary>
    public static readonly Error AlreadyVoted = new("stats.mvp-already-voted", ErrorKind.Conflict);

    /// <summary>No body, or a candidate that is not a member id: the value is not echoed.</summary>
    public static readonly Error VoteInvalid = new("stats.mvp-vote-invalid", ErrorKind.Validation);
}
