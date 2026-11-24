using System.Globalization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Http.AppConfig;
using Sacou.Modules.Matches.Contracts;
using Sacou.Modules.Stats.Access;
using Sacou.Modules.Stats.Domain.MvpVoting;
using Sacou.Modules.Stats.Infrastructure;
using Sacou.Modules.Stats.MvpVoting;
using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Stats.GetMvpVoting;

/// <summary>Why the caller cannot vote now. A guest has no sign-in, so it never reads the ballot.</summary>
internal enum MvpBallotRefusal
{
    NotOpen,
    Closed,
    NotPlayed,
    AlreadyVoted,
}

/// <summary>The caller's own vote: never anyone else's (ADR 0072, D7).</summary>
internal sealed record MyMvpVoteResponse(Guid CandidateMemberId, DateTimeOffset CastAt);

/// <summary>One line of the screen 12a; the app turns <c>mainSide</c> into the colour of the team.</summary>
internal sealed record MvpCandidateResponse(Guid MemberId, int MatchesPlayed, int PlusMinus, int Wins, CourtSide? MainSide);

/// <summary>
/// The ballot of the caller: the window, whether they may vote and why not, their own vote, and who played but
/// themselves. No count, no total of voters, no list of who voted: nothing of anyone else's vote (ADR 0072, D7).
/// </summary>
internal sealed record MvpBallotResponse(
    MvpVotingState State,
    DateTimeOffset OpensAt,
    DateTimeOffset ClosesAt,
    bool CanVote,
    MvpBallotRefusal? Reason,
    MyMvpVoteResponse? MyVote,
    IReadOnlyList<MvpCandidateResponse> Candidates);

/// <summary>
/// <c>GET /v1/groups/{groupId}/rounds/{roundId}/mvp-voting</c> (<c>ViewGroup</c>): the ballot of the screen 12a
/// (ADR 0072). It reads the fresh projection, which may replay the stream, so it is under <c>court-sync</c>, like the
/// summary; <c>no-store</c>.
/// </summary>
internal static class GetMvpVotingEndpoint
{
    public const string Name = "GetMvpVoting";
    public const string Route = "/rounds/{roundId:guid}/mvp-voting";

    /// <summary>Where the ballot of a round is read: the location of a cast vote.</summary>
    public static string LocationOf(Guid groupId, Guid roundId) =>
        string.Create(CultureInfo.InvariantCulture, $"/v1/groups/{groupId}/rounds/{roundId}/mvp-voting");

    public static RouteGroupBuilder MapGetMvpVoting(this RouteGroupBuilder group) => group.MapRoundRead(Route, Name, HandleAsync, AppFeature.MvpVote);

    private static async Task<Results<Ok<MvpBallotResponse>, ProblemHttpResult>> HandleAsync(
        Guid roundId, HttpContext context, GetMvpVotingHandler handler, CancellationToken cancellationToken)
    {
        var access = context.StatsAccess();
        var ballot = await handler.HandleAsync(access.GroupId, roundId, new MemberId(access.MemberId), cancellationToken).ConfigureAwait(false);
        return ballot.ToHttpResult(response => TypedResults.Ok(response));
    }
}

internal sealed class GetMvpVotingHandler(IMvpVotingRounds rounds, IMvpVoteStore votes, TimeProvider time)
{
    public async Task<Result<MvpBallotResponse>> HandleAsync(Guid groupId, Guid roundId, MemberId me, CancellationToken cancellationToken)
    {
        var found = await rounds.FindAsync(groupId, roundId, cancellationToken).ConfigureAwait(false);
        if (found.IsFailure)
        {
            return Result.Failure<MvpBallotResponse>(found.Error);
        }

        var mine = await votes.FindMineAsync(groupId, roundId, me, cancellationToken).ConfigureAwait(false);
        return Result.Success(ToResponse(found.Value, me, mine, time.GetUtcNow()));
    }

    private static MvpBallotResponse ToResponse(MvpVotingRound round, MemberId me, MvpVote? mine, DateTimeOffset now)
    {
        var ballot = round.Ballot;
        var refusal = ballot.RefusalFor(me, alreadyVoted: mine is not null, now);
        return new MvpBallotResponse(
            ballot.Window.StateAt(now),
            ballot.Window.OpensAt,
            ballot.Window.ClosesAt,
            CanVote: refusal is null,
            ReasonOf(refusal),
            mine is null ? null : new MyMvpVoteResponse(mine.Candidate.Value, mine.CastAt),
            [.. ballot.CandidatesFor(me).Select(candidate => new MvpCandidateResponse(
                candidate.MemberId.Value, candidate.MatchesPlayed, candidate.PlusMinus, candidate.Wins, round.MainSideOf(candidate.MemberId)))]);
    }

    private static MvpBallotRefusal? ReasonOf(Error? refusal) => refusal switch
    {
        null => null,
        _ when refusal == MvpVotingErrors.NotOpen => MvpBallotRefusal.NotOpen,
        _ when refusal == MvpVotingErrors.Closed => MvpBallotRefusal.Closed,
        _ when refusal == MvpVotingErrors.AlreadyVoted => MvpBallotRefusal.AlreadyVoted,
        _ => MvpBallotRefusal.NotPlayed,
    };
}
