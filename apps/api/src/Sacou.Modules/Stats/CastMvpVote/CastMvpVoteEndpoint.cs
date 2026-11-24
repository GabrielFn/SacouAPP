using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Logging;
using Sacou.Http;
using Sacou.Http.AppConfig;
using Sacou.Http.RateLimiting;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Stats.Access;
using Sacou.Modules.Stats.Domain.MvpVoting;
using Sacou.Modules.Stats.GetMvpVoting;
using Sacou.Modules.Stats.Infrastructure;
using Sacou.Modules.Stats.MvpVoting;
using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Stats.CastMvpVote;

/// <summary>Only the candidate, as text, so a value that is not an id is the vote's own 400, never echoed.</summary>
internal sealed record CastMvpVoteRequest(string? CandidateMemberId)
{
    public override string ToString() => nameof(CastMvpVoteRequest);
}

/// <summary>
/// <c>POST /v1/groups/{groupId}/rounds/{roundId}/mvp-voting/vote</c> (<c>ViewGroup</c>, then the rules of ADR 0072,
/// D4): one final vote per member per round. Under <c>court-sync</c>, as the ballot read: the vote reads the projection and may
/// replay the stream (ADR 0072, D10); <c>no-store</c>.
/// </summary>
internal static class CastMvpVoteEndpoint
{
    public const string Name = "CastMvpVote";
    public const string Route = "/rounds/{roundId:guid}/mvp-voting/vote";

    public static RouteGroupBuilder MapCastMvpVote(this RouteGroupBuilder group)
    {
        group.MapPost(Route, HandleAsync).WithName(Name).RequireFeature(AppFeature.MvpVote).RequireCapability(GroupCapability.ViewGroup).WithNoStore()
            .RequireRateLimiting(RateLimitPolicies.CourtSync)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity);
        return group;
    }

    private static async Task<Results<Created<MyMvpVoteResponse>, ProblemHttpResult>> HandleAsync(
        Guid roundId, CastMvpVoteRequest? request, HttpContext context, CastMvpVoteHandler handler, CancellationToken cancellationToken)
    {
        var access = context.StatsAccess();
        var cast = await handler.HandleAsync(access.GroupId, roundId, new MemberId(access.MemberId), request?.CandidateMemberId, cancellationToken)
            .ConfigureAwait(false);
        return cast.ToHttpResult(vote => TypedResults.Created(GetMvpVotingEndpoint.LocationOf(access.GroupId, roundId), vote));
    }
}

internal sealed class CastMvpVoteHandler(IMvpVotingRounds rounds, IMvpVoteStore votes, TimeProvider time, ILogger<CastMvpVoteHandler> logger)
{
    private const string IdFormat = "D";

    public async Task<Result<MyMvpVoteResponse>> HandleAsync(
        Guid groupId, Guid roundId, MemberId voter, string? candidateText, CancellationToken cancellationToken)
    {
        var cast = await CastAsync(groupId, roundId, voter, candidateText, cancellationToken).ConfigureAwait(false);
        var result = cast.IsSuccess ? MvpVotingLog.CastResult : cast.Error.Code;
        MvpVotingLog.Voted(logger, roundId, result);
        return cast;
    }

    private async Task<Result<MyMvpVoteResponse>> CastAsync(
        Guid groupId, Guid roundId, MemberId voter, string? candidateText, CancellationToken cancellationToken)
    {
        if (!Guid.TryParseExact(candidateText, IdFormat, out var candidate) || candidate == Guid.Empty)
        {
            return Result.Failure<MyMvpVoteResponse>(MvpVotingErrors.VoteInvalid);
        }

        var found = await rounds.FindAsync(groupId, roundId, cancellationToken).ConfigureAwait(false);
        if (found.IsFailure)
        {
            return Result.Failure<MyMvpVoteResponse>(found.Error);
        }

        var mine = await votes.FindMineAsync(groupId, roundId, voter, cancellationToken).ConfigureAwait(false);
        var decided = found.Value.Ballot.Cast(voter, new MemberId(candidate), alreadyVoted: mine is not null, time.GetUtcNow());
        if (decided.IsFailure)
        {
            return Result.Failure<MyMvpVoteResponse>(decided.Error);
        }

        // Two taps at once both pass the read above: the key of the table keeps the first and refuses the second (D9).
        var stored = await votes.TryCastAsync(groupId, roundId, decided.Value, cancellationToken).ConfigureAwait(false);
        return stored
            ? Result.Success(new MyMvpVoteResponse(decided.Value.Candidate.Value, decided.Value.CastAt))
            : Result.Failure<MyMvpVoteResponse>(MvpVotingErrors.AlreadyVoted);
    }
}
