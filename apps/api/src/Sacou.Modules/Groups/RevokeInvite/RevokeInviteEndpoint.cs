using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Domain.Invites;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.Infrastructure;

namespace Sacou.Modules.Groups.RevokeInvite;

/// <summary>
/// <c>DELETE /v1/groups/{groupId}/invites/{inviteId}</c>: 204, also for a link already revoked or expired.
/// The invite is looked up inside this group's aggregate only: another group's invite id is 404
/// <c>groups.invite-not-found</c>, like one that never existed, and stays valid.
/// </summary>
internal static class RevokeInviteEndpoint
{
    public const string Name = "RevokeGroupInvite";
    public const string Route = "/invites/{inviteId:guid}";

    public static RouteGroupBuilder MapRevokeInvite(this RouteGroupBuilder group)
    {
        group.MapDelete(Route, HandleAsync).WithName(Name).RequireGroupPermission(GroupPermission.ManageInvites);
        return group;
    }

    private static Task<Results<NoContent, ProblemHttpResult>> HandleAsync(
        Guid inviteId, HttpContext context, IGroupStore store, TimeProvider time, CancellationToken cancellationToken) =>
        GroupWrite.ExecuteAsync(
            context,
            store,
            (group, actor) => group.RevokeInvite(actor, new InviteId(inviteId), time.GetUtcNow()),
            TypedResults.NoContent,
            cancellationToken);
}
