using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Access;
using Sacou.Modules.Sessions.Application;
using Sacou.Modules.Sessions.Domain.Rounds;

namespace Sacou.Modules.Sessions.GetRound;

/// <summary><c>GET /v1/groups/{groupId}/rounds/{roundId}</c>: any active member (<c>ViewGroup</c>); repairs on read (D7).</summary>
internal static class GetRoundEndpoint
{
    public const string Name = "GetRound";
    public const string Route = "/rounds/{roundId:guid}";

    public static RouteGroupBuilder MapGetRound(this RouteGroupBuilder group)
    {
        group.MapGet(Route, HandleAsync).WithName(Name).RequireCapability(GroupCapability.ViewGroup);
        return group;
    }

    private static async Task<Results<Ok<RoundResponse>, ProblemHttpResult>> HandleAsync(
        Guid roundId, HttpContext context, GetRoundHandler handler, CancellationToken cancellationToken)
    {
        var found = await handler.HandleAsync(context.RoundAccess(), new RoundId(roundId), cancellationToken).ConfigureAwait(false);
        return found.ToHttpResult(round => TypedResults.Ok(round));
    }
}
