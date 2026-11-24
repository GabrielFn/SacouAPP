using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Sessions.Access;
using Sacou.Modules.Sessions.Domain.Rounds;

namespace Sacou.Modules.Sessions.DrawTeams;

/// <summary>
/// <c>POST /v1/groups/{groupId}/rounds/{roundId}/draw</c> <c>{ locks?, reserves? }</c> (<c>DrawTeams</c>): the balanced
/// draw of the confirmed players (docs/dominio/sorteio.md, ADR 0055). The answer carries the private levels, so only
/// the admin and the co-admin reach it, and every answer, errors included, carries <c>Cache-Control: no-store</c>
/// (<see cref="NoStore"/>). Nothing is stored:
/// "Sortear de novo" is another call.
/// </summary>
internal static class DrawTeamsEndpoint
{
    public const string Name = "DrawTeams";
    public const string Route = "/rounds/{roundId:guid}/draw";

    public static RouteGroupBuilder MapDrawTeams(this RouteGroupBuilder group)
    {
        group.MapPost(Route, HandleAsync).WithName(Name).RequireDrawer();
        return group;
    }

    private static async Task<Results<Ok<DrawTeamsResponse>, ProblemHttpResult>> HandleAsync(
        Guid roundId, DrawTeamsRequest request, HttpContext context, DrawTeamsHandler handler, CancellationToken cancellationToken)
    {
        var drawn = await handler.HandleAsync(context.RoundAccess(), new RoundId(roundId), request, cancellationToken).ConfigureAwait(false);
        return drawn.ToHttpResult(draw => TypedResults.Ok(draw));
    }
}
