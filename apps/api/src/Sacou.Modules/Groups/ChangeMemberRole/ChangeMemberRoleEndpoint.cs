using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.Infrastructure;
using ContractRole = Sacou.Modules.Groups.Contracts.GroupRole;

namespace Sacou.Modules.Groups.ChangeMemberRole;

/// <summary>
/// <c>PUT /v1/groups/{groupId}/members/{memberId}/role</c> <c>{ role }</c>. The filter asks for the basic
/// permission; the aggregate asks for <c>AssignAdminRole</c> when the target or the new role is admin or
/// co-admin, and answers 403 <c>groups.forbidden</c> as the filter would. Same role: 200, nothing written.
/// </summary>
internal static class ChangeMemberRoleEndpoint
{
    public const string Name = "ChangeMemberRole";
    public const string Route = "/members/{memberId:guid}/role";

    public static RouteGroupBuilder MapChangeMemberRole(this RouteGroupBuilder group)
    {
        group.MapPut(Route, HandleAsync).WithName(Name).RequireGroupPermission(GroupPermission.AssignBasicRole);
        return group;
    }

    private static Task<Results<Ok<ChangeMemberRoleResponse>, ProblemHttpResult>> HandleAsync(
        Guid memberId,
        ChangeMemberRoleRequest request,
        HttpContext context,
        IGroupStore store,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var role = ContractValues.ToDomain(request.Role);
        return GroupWrite.ExecuteAsync(
            context,
            store,
            (group, actor) => group.ChangeRole(actor, new MemberId(memberId), role, time.GetUtcNow()),
            () => TypedResults.Ok(new ChangeMemberRoleResponse(memberId, request.Role)),
            cancellationToken);
    }
}

/// <summary>Only the role, and it must be there: a missing or null role is a 400, never a default value (ADR 0039).</summary>
internal sealed record ChangeMemberRoleRequest([property: JsonRequired] ContractRole Role);

internal sealed record ChangeMemberRoleResponse(Guid MemberId, ContractRole Role);
