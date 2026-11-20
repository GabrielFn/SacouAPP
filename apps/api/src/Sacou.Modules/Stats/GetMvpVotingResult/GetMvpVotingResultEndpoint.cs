using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Stats.Access;
using Sacou.Modules.Stats.Domain.MvpVoting;
using Sacou.Modules.Stats.MvpVoting;
using Sacou.Shared.Results;

namespace Sacou.Modules.Stats.GetMvpVotingResult;

/// <summary>
/// The result of the vote (question 144): while it is not closed, only the state and <see cref="ClosesAt"/>; once
/// closed, only the winners (none without a valid vote, more than one on a full tie) and how many voted. Never a
/// count per candidate, nor who voted for whom (ADR 0072, D7).
/// </summary>
internal sealed record MvpVotingResultResponse(MvpVotingState State, DateTimeOffset ClosesAt, IReadOnlyList<Guid>? Winners, int? Voters)
{
    public static MvpVotingResultResponse From(RoundMvpVote vote)
    {
        ArgumentNullException.ThrowIfNull(vote);
        return vote.Result is { } result
            ? new MvpVotingResultResponse(vote.State, vote.Window.ClosesAt, [.. result.Winners.Select(winner => winner.Value)], result.Voters)
            : new MvpVotingResultResponse(vote.State, vote.Window.ClosesAt, Winners: null, Voters: null);
    }
}

/// <summary>
/// <c>GET /v1/groups/{groupId}/rounds/{roundId}/mvp-voting/result</c> (<c>ViewGroup</c>). The first read after the
/// close counts the vote and freezes it (ADR 0072, D12). It reads the fresh projection, which may replay the stream,
/// so it is under <c>court-sync</c>, like the ballot; <c>no-store</c>.
/// </summary>
internal static class GetMvpVotingResultEndpoint
{
    public const string Name = "GetMvpVotingResult";
    public const string Route = "/rounds/{roundId:guid}/mvp-voting/result";

    public static RouteGroupBuilder MapGetMvpVotingResult(this RouteGroupBuilder group) => group.MapRoundRead(Route, Name, HandleAsync);

    private static async Task<Results<Ok<MvpVotingResultResponse>, ProblemHttpResult>> HandleAsync(
        Guid roundId, HttpContext context, GetMvpVotingResultHandler handler, CancellationToken cancellationToken)
    {
        var access = context.StatsAccess();
        var result = await handler.HandleAsync(access.GroupId, roundId, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(response => TypedResults.Ok(response));
    }
}

internal sealed class GetMvpVotingResultHandler(IMvpVotingRounds rounds, MvpOutcomes outcomes)
{
    public async Task<Result<MvpVotingResultResponse>> HandleAsync(Guid groupId, Guid roundId, CancellationToken cancellationToken)
    {
        var found = await rounds.FindAsync(groupId, roundId, cancellationToken).ConfigureAwait(false);
        if (found.IsFailure)
        {
            return Result.Failure<MvpVotingResultResponse>(found.Error);
        }

        var vote = await outcomes.OfBallotAsync(groupId, roundId, found.Value.Ballot, cancellationToken).ConfigureAwait(false);
        return Result.Success(MvpVotingResultResponse.From(vote));
    }
}
