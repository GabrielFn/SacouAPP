using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Access;
using Sacou.Modules.Sessions.Application;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.GetRound;

namespace Sacou.Modules.Sessions.UpdateRound;

/// <summary><c>PATCH /v1/groups/{groupId}/rounds/{roundId}</c>: date, time, venue and layer (<c>ManageRounds</c>).</summary>
internal static class UpdateRoundEndpoint
{
    public const string Name = "UpdateRound";

    public static RouteGroupBuilder MapUpdateRound(this RouteGroupBuilder group)
    {
        group.MapPatch(GetRoundEndpoint.Route, HandleAsync).WithName(Name)
            .RequireCapability(GroupCapability.ManageRounds)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status409Conflict);
        return group;
    }

    private static async Task<Results<Ok<RoundResponse>, ProblemHttpResult>> HandleAsync(
        Guid roundId, UpdateRoundRequest request, HttpContext context, UpdateRoundHandler handler, CancellationToken cancellationToken)
    {
        var updated = await handler.HandleAsync(context.RoundAccess(), new RoundId(roundId), request, cancellationToken).ConfigureAwait(false);
        return updated.ToHttpResult(round => TypedResults.Ok(round));
    }
}
