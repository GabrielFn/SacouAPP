using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Contracts;
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
/// <c>sessions.round-not-started</c>; a cancelled round is 409
/// <c>sessions.round-canceled</c>. Court events that arrive later still count. <c>no-store</c>.
/// </summary>
internal static class CloseRoundEndpoint
{
    public const string Name = "CloseRound";
    public const string Route = "/rounds/{roundId:guid}/close";

    public static RouteGroupBuilder MapCloseRound(this RouteGroupBuilder group)
    {
        group.MapPost(Route, HandleAsync).WithName(Name).RequireCapability(GroupCapability.WriteCourt).WithNoStore();
        return group;
    }

    private static async Task<Results<Ok<CloseRoundResponse>, ProblemHttpResult>> HandleAsync(
        Guid roundId, HttpContext context, CloseRoundHandler handler, CancellationToken cancellationToken)
    {
        var closed = await handler.HandleAsync(context.RoundAccess(), new RoundId(roundId), cancellationToken).ConfigureAwait(false);
        return closed.ToHttpResult(round => TypedResults.Ok(round));
    }
}

/// <summary>The close is decided under the round's lock (ADR 0043), so two taps at once store one instant.</summary>
internal sealed class CloseRoundHandler(RoundWriter writer)
{
    public async Task<Result<CloseRoundResponse>> HandleAsync(RoundAccess access, RoundId id, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(access);
        var written = await writer.ExecuteAsync(
            access, id, GroupCapability.WriteCourt, context => context.Round.Close(context.Now), cancellationToken).ConfigureAwait(false);
        return written.IsSuccess
            ? Result.Success(ToResponse(written.Value.Change.Round))
            : Result.Failure<CloseRoundResponse>(written.Error);
    }

    private static CloseRoundResponse ToResponse(Round round) =>
        new(round.ClosedAt ?? throw new InvalidOperationException("A closed round has its instant."), round.EndsAt);
}
