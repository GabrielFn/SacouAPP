using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Access;
using Sacou.Modules.Sessions.Application;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.RoundLinks;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.CancelRound;

/// <summary>
/// <c>POST /v1/groups/{groupId}/rounds/{roundId}/cancel</c> (<c>ManageRounds</c>). The attendances stay for the
/// history; there is no delete. Cancelling again is a success without effect.
/// </summary>
internal static class CancelRoundEndpoint
{
    public const string Name = "CancelRound";
    public const string Route = "/rounds/{roundId:guid}/cancel";

    public static RouteGroupBuilder MapCancelRound(this RouteGroupBuilder group)
    {
        group.MapPost(Route, HandleAsync).WithName(Name).RequireCapability(GroupCapability.ManageRounds);
        return group;
    }

    private static async Task<Results<Ok<RoundResponse>, ProblemHttpResult>> HandleAsync(
        Guid roundId, HttpContext context, CancelRoundHandler handler, CancellationToken cancellationToken)
    {
        var canceled = await handler.HandleAsync(context.RoundAccess(), new RoundId(roundId), cancellationToken).ConfigureAwait(false);
        return canceled.ToHttpResult(round => TypedResults.Ok(round));
    }
}

internal sealed class CancelRoundHandler(RoundWriter writer, RoundShareLinks links)
{
    public async Task<Result<RoundResponse>> HandleAsync(RoundAccess access, RoundId id, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(access);
        var written = await writer.ExecuteAsync(
            access, id, GroupCapability.ManageRounds, context => Result.Success(context.Round.Cancel()), cancellationToken).ConfigureAwait(false);
        return links.Respond(written, access);
    }
}
