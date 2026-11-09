using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.Infrastructure;

namespace Sacou.Modules.Groups.LeaveGroup;

/// <summary>
/// <c>POST /v1/groups/{groupId}/leave</c>: 204, or 409 <c>groups.last-admin</c> for the only active admin,
/// who promotes someone first. The member keeps the same <c>MemberId</c> for when they come back (part 3).
/// </summary>
internal static class LeaveGroupEndpoint
{
    public const string Name = "LeaveGroup";
    public const string Route = "/leave";

    public static RouteGroupBuilder MapLeaveGroup(this RouteGroupBuilder group)
    {
        group.MapPost(Route, HandleAsync).WithName(Name).RequireGroupPermission(GroupPermission.Leave);
        return group;
    }

    private static Task<Results<NoContent, ProblemHttpResult>> HandleAsync(
        HttpContext context, IGroupStore store, TimeProvider time, CancellationToken cancellationToken) =>
        GroupWrite.ExecuteAsync(
            context,
            store,
            (group, actor) => group.Leave(actor, time.GetUtcNow()),
            TypedResults.NoContent,
            cancellationToken);
}
