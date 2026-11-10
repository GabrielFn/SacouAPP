using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Domain.Invites;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.Infrastructure;

namespace Sacou.Modules.Groups.ListInvites;

/// <summary>
/// <c>GET /v1/groups/{groupId}/invites</c>: the links still valid, oldest first, for the "Convites" tab of
/// screen 19. Never the token nor its hash: the app keeps the link it made (ADR 0040, D10).
/// </summary>
internal static class ListInvitesEndpoint
{
    public const string Name = "ListGroupInvites";
    public const string Route = "/invites";

    public static RouteGroupBuilder MapListInvites(this RouteGroupBuilder group)
    {
        group.MapGet(Route, HandleAsync).WithName(Name).RequireGroupPermission(GroupPermission.ManageInvites);
        return group;
    }

    private static async Task<Ok<IReadOnlyList<InviteResponse>>> HandleAsync(
        HttpContext context, IGroupStore store, TimeProvider time, CancellationToken cancellationToken)
    {
        var access = context.GroupAccess();
        var invites = await store.ListValidInvitesAsync(access.GroupId, time.GetUtcNow(), cancellationToken).ConfigureAwait(false);
        IReadOnlyList<InviteResponse> body = [.. invites.Select(InviteResponse.From)];
        return TypedResults.Ok(body);
    }
}

internal sealed record InviteResponse(Guid InviteId, DateTimeOffset CreatedAt, Guid CreatedBy, DateTimeOffset? ExpiresAt, int UseCount)
{
    public static InviteResponse From(GroupInvite invite) =>
        new(invite.Id.Value, invite.CreatedAt, invite.CreatedBy.Value, invite.ExpiresAt, invite.UseCount);
}
