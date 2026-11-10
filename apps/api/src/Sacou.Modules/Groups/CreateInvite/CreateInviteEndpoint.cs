using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.Net.Http.Headers;
using Sacou.Http;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Domain.Permissions;

namespace Sacou.Modules.Groups.CreateInvite;

/// <summary>
/// <c>POST /v1/groups/{groupId}/invites</c>: 201 <c>{ inviteId, token, expiresAt }</c>, the one time the token
/// leaves the API (ADR 0040, D10). No body, no <c>Location</c> (there is no route that shows one invite), and
/// <c>Cache-Control: no-store</c>, so no cache along the way keeps the token.
/// </summary>
internal static class CreateInviteEndpoint
{
    public const string Name = "CreateGroupInvite";
    public const string Route = "/invites";

    private const string NoStore = "no-store";

    public static RouteGroupBuilder MapCreateInvite(this RouteGroupBuilder group)
    {
        group.MapPost(Route, HandleAsync).WithName(Name).RequireGroupPermission(GroupPermission.ManageInvites)
            .ProducesProblem(StatusCodes.Status409Conflict);
        return group;
    }

    private static async Task<Results<Created<CreateInviteResponse>, ProblemHttpResult>> HandleAsync(
        HttpContext context, CreateInviteHandler handler, CancellationToken cancellationToken)
    {
        var created = await handler.HandleAsync(context.GroupAccess(), cancellationToken).ConfigureAwait(false);
        context.Response.Headers[HeaderNames.CacheControl] = NoStore;
        return created.ToHttpResult(body => TypedResults.Created((string?)null, body));
    }
}
