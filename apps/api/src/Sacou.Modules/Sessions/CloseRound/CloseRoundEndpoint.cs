using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Http.RateLimiting;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Contracts;
using Sacou.Modules.Sessions.Access;
using Sacou.Modules.Sessions.Application;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.CloseRound;

/// <summary>When the round was closed, and when it ended: the earlier of that and the automatic end (ADR 0072, D1).</summary>
internal sealed record CloseRoundResponse(DateTimeOffset ClosedAt, DateTimeOffset EndsAt);

/// <summary>
/// <c>POST /v1/groups/{groupId}/rounds/{roundId}/close</c> (<c>WriteCourt</c>): "Encerrar rodada", which opens the MVP
/// vote (ADR 0072, D1). Closing again answers the same <c>closedAt</c>; before the start it is 409
/// <c>sessions.round-not-started</c> unless a match was already finished (ADR 0076); a cancelled round is 409
/// <c>sessions.round-canceled</c>. Court events that arrive later still count. Under <c>court-sync</c>, since it may
/// summarize the court; a court that cannot be summarized now is a 503 <c>matches.court-busy</c> (ADR 0081, Part 2). <c>no-store</c>.
/// </summary>
internal static class CloseRoundEndpoint
{
    public const string Name = "CloseRound";
    public const string Route = "/rounds/{roundId:guid}/close";

    public static RouteGroupBuilder MapCloseRound(this RouteGroupBuilder group)
    {
        group.MapPost(Route, HandleAsync).WithName(Name).RequireCapability(GroupCapability.WriteCourt)
            .RequireRateLimiting(RateLimitPolicies.CourtSync)
            .WithNoStore();
        return group;
    }

    private static async Task<Results<Ok<CloseRoundResponse>, ProblemHttpResult>> HandleAsync(
        Guid roundId, HttpContext context, CloseRoundHandler handler, CancellationToken cancellationToken)
    {
        var closed = await handler.HandleAsync(context.RoundAccess(), new RoundId(roundId), cancellationToken).ConfigureAwait(false);
        if (closed.IsFailure)
        {
            UnavailableRetry.Apply(context.Response, closed.Error);
        }

        return closed.ToHttpResult(round => TypedResults.Ok(round));
    }
}

/// <summary>The close is decided under the round's lock (ADR 0043), so two taps at once store one instant.</summary>
internal sealed class CloseRoundHandler(RoundWriter writer, IRoundFacts rounds, IRoundPlayedMatches playedMatches, TimeProvider time)
{
    public async Task<Result<CloseRoundResponse>> HandleAsync(RoundAccess access, RoundId id, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(access);
        var hasFinishedMatch = await HasFinishedMatchBeforeTheStartAsync(access, id, cancellationToken).ConfigureAwait(false);
        if (hasFinishedMatch.IsFailure)
        {
            return Result.Failure<CloseRoundResponse>(hasFinishedMatch.Error);
        }

        var written = await writer.ExecuteAsync(
            access, id, GroupCapability.WriteCourt, context => context.Round.Close(context.Now, hasFinishedMatch.Value), cancellationToken)
            .ConfigureAwait(false);
        return written.IsSuccess
            ? Result.Success(ToResponse(written.Value.Change.Round))
            : Result.Failure<CloseRoundResponse>(written.Error);
    }

    /// <summary>
    /// Asked only of a round not yet closed nor cancelled, before its start, the one case that needs it: the court says
    /// if a match was finished (ADR 0076). Every other close is decided by the round alone and never summarizes the
    /// court (M5-M2, ADR 0081 Part 2); the lock re-reads the round, so a round closed in between is still closed once.
    /// </summary>
    private async Task<Result<bool>> HasFinishedMatchBeforeTheStartAsync(RoundAccess access, RoundId id, CancellationToken cancellationToken)
    {
        var facts = await rounds.FindAsync(access.GroupId.Value, id.Value, cancellationToken).ConfigureAwait(false);
        if (facts is null || facts.ClosedAt is not null || facts.State == RoundState.Canceled || time.GetUtcNow() >= facts.StartsAt)
        {
            return Result.Success(false);
        }

        return await playedMatches.HasFinishedMatchAsync(access.GroupId.Value, id.Value, facts.Summary, cancellationToken).ConfigureAwait(false);
    }

    private static CloseRoundResponse ToResponse(Round round) =>
        new(round.ClosedAt ?? throw new InvalidOperationException("A closed round has its instant."), round.EndsAt);
}
