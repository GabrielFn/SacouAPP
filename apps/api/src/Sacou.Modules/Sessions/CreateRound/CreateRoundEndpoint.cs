using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Access;
using Sacou.Modules.Sessions.Application;

namespace Sacou.Modules.Sessions.CreateRound;

/// <summary><c>POST /v1/groups/{groupId}/rounds</c>: 201 with the round, the mensalistas already confirmed (<c>ManageRounds</c>).</summary>
internal static class CreateRoundEndpoint
{
    public const string Name = "CreateRound";
    public const string Route = "/rounds";

    public static RouteGroupBuilder MapCreateRound(this RouteGroupBuilder group)
    {
        group.MapPost(Route, HandleAsync).WithName(Name)
            .RequireCapability(GroupCapability.ManageRounds)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status409Conflict);
        return group;
    }

    private static async Task<Results<Created<RoundResponse>, ProblemHttpResult>> HandleAsync(
        CreateRoundRequest request, HttpContext context, CreateRoundHandler handler, CancellationToken cancellationToken)
    {
        var access = context.RoundAccess();
        var created = await handler.HandleAsync(access, request, cancellationToken).ConfigureAwait(false);
        return created.ToHttpResult(round => TypedResults.Created($"/v1/groups/{access.GroupId.Value}{Route}/{round.RoundId}", round));
    }
}
