using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.Infrastructure;

namespace Sacou.Modules.Groups.RemoveMember;

/// <summary>
/// <c>DELETE /v1/groups/{groupId}/members/{memberId}</c>: 204. The filter asks for <c>RemoveMember</c>; the
/// aggregate asks for <c>RemoveAdmin</c> when the target is admin or co-admin. Removing oneself is
/// <c>groups.use-leave</c>. The row stays, marked as removed, and the person no longer sees the group.
/// </summary>
internal static class RemoveMemberEndpoint
{
    public const string Name = "RemoveGroupMember";
    public const string Route = "/members/{memberId:guid}";

    public static RouteGroupBuilder MapRemoveMember(this RouteGroupBuilder group)
    {
        group.MapDelete(Route, HandleAsync).WithName(Name).RequireGroupPermission(GroupPermission.RemoveMember)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status409Conflict);
        return group;
    }

    private static Task<Results<NoContent, ProblemHttpResult>> HandleAsync(
        Guid memberId, HttpContext context, IGroupStore store, TimeProvider time, CancellationToken cancellationToken) =>
        GroupWrite.ExecuteAsync(
            context,
            store,
            (group, actor) => group.Remove(actor, new MemberId(memberId), time.GetUtcNow()),
            TypedResults.NoContent,
            cancellationToken);
}
