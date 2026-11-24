using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Sessions.Access;
using Sacou.Modules.Sessions.Application;
using Sacou.Modules.Sessions.Domain.Rounds;

namespace Sacou.Modules.Sessions.ConfirmTeams;

/// <summary>
/// <c>PUT /v1/groups/{groupId}/rounds/{roundId}/teams</c> <c>{ teams, reserves }</c> (<c>DrawTeams</c>): publishes the teams
/// of screen 07 to every member, in the round's <c>teams</c> (ADR 0078). Replaces the earlier ones whole, so a repeated
/// call is harmless. The answer is the round as the caller reads it; every answer, errors included, is <c>no-store</c>.
/// </summary>
internal static class ConfirmTeamsEndpoint
{
    public const string Name = "ConfirmTeams";
    public const string Route = "/rounds/{roundId:guid}/teams";

    public static RouteGroupBuilder MapConfirmTeams(this RouteGroupBuilder group)
    {
        group.MapPut(Route, HandleAsync).WithName(Name).RequireDrawer();
        return group;
    }

    private static async Task<Results<Ok<RoundResponse>, ProblemHttpResult>> HandleAsync(
        Guid roundId, ConfirmTeamsRequest request, HttpContext context, ConfirmTeamsHandler handler, CancellationToken cancellationToken)
    {
        var confirmed = await handler.HandleAsync(context.RoundAccess(), new RoundId(roundId), request, cancellationToken).ConfigureAwait(false);
        return confirmed.ToHttpResult(round => TypedResults.Ok(round));
    }
}
