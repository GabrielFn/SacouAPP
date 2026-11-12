using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Access;
using Sacou.Modules.Sessions.Application;
using Sacou.Modules.Sessions.CreateRound;

namespace Sacou.Modules.Sessions.ListRounds;

/// <summary><c>GET /v1/groups/{groupId}/rounds</c>: any active member may see the rounds (<c>ViewGroup</c>).</summary>
internal static class ListRoundsEndpoint
{
    public const string Name = "ListRounds";

    public static RouteGroupBuilder MapListRounds(this RouteGroupBuilder group)
    {
        group.MapGet(CreateRoundEndpoint.Route, HandleAsync).WithName(Name).RequireCapability(GroupCapability.ViewGroup);
        return group;
    }

    private static async Task<Results<Ok<IReadOnlyList<RoundSummaryResponse>>, ProblemHttpResult>> HandleAsync(
        HttpContext context, ListRoundsHandler handler, CancellationToken cancellationToken)
    {
        var listed = await handler.HandleAsync(context.RoundAccess(), cancellationToken).ConfigureAwait(false);
        return listed.ToHttpResult(rounds => TypedResults.Ok(rounds));
    }
}
