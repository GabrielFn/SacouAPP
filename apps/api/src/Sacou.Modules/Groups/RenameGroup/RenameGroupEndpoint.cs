using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.RenameGroup;

/// <summary>
/// <c>PATCH /v1/groups/{groupId}</c> <c>{ name }</c>. One column, no rule about members, so no group lock:
/// the last rename wins (ADR 0040, D8). The UPDATE checks the role again, so a caller demoted after the
/// filter gets 403 and the name stays.
/// </summary>
internal static class RenameGroupEndpoint
{
    public const string Name = "RenameGroup";

    public static RouteGroupBuilder MapRenameGroup(this RouteGroupBuilder group)
    {
        group.MapPatch(string.Empty, HandleAsync).WithName(Name).RequireGroupPermission(GroupPermission.RenameGroup)
            .ProducesProblem(StatusCodes.Status400BadRequest);
        return group;
    }

    private static async Task<Results<Ok<RenameGroupResponse>, ProblemHttpResult>> HandleAsync(
        RenameGroupRequest request, HttpContext context, IGroupStore store, CancellationToken cancellationToken)
    {
        var access = context.GroupAccess();
        var renamed = await RenameAsync(access, request.Name, store, cancellationToken).ConfigureAwait(false);
        return renamed.ToHttpResult(name => TypedResults.Ok(new RenameGroupResponse(access.GroupId.Value, name.Value)));
    }

    private static async Task<Result<GroupName>> RenameAsync(GroupAccess access, string? name, IGroupStore store, CancellationToken cancellationToken)
    {
        var groupName = GroupName.Create(name);
        if (groupName.IsFailure)
        {
            return groupName;
        }

        return await store.RenameAsync(access.GroupId, access.Caller, groupName.Value, cancellationToken).ConfigureAwait(false)
            ? groupName
            : Result.Failure<GroupName>(GroupErrors.Forbidden);
    }
}

/// <summary>Only the name: a field the record does not declare is a 400 (ADR 0039).</summary>
internal sealed record RenameGroupRequest(string? Name);

internal sealed record RenameGroupResponse(Guid GroupId, string Name);
