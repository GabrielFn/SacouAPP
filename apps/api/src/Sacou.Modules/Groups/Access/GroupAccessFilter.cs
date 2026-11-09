using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Sacou.Http;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Access;

/// <summary>
/// Secure by default for every route under <c>/v1/groups/{groupId}</c> (ADR 0040, D3): a person without a
/// user row gets 403 <c>identity.user-not-registered</c>; a non-member, or a member who left or was removed,
/// gets the same 404 as a group that does not exist; a member whose role lacks the endpoint's permission
/// gets 403 <c>groups.forbidden</c>. The role comes from the database on every request, never from a claim.
/// </summary>
internal sealed class GroupAccessFilter : IEndpointFilter
{
    public const string GroupIdRouteValue = "groupId";

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(next);
        var http = context.HttpContext;
        var access = await ResolveAsync(http, RequiredPermission(http)).ConfigureAwait(false);
        if (access.IsFailure)
        {
            return ProblemResults.From(access.Error);
        }

        http.Features.Set(access.Value);
        return await next(context).ConfigureAwait(false);
    }

    /// <summary>Fails closed: an endpoint that does not declare exactly one permission never runs.</summary>
    private static GroupPermission RequiredPermission(HttpContext http)
    {
        var declared = http.GetEndpoint()?.Metadata.GetOrderedMetadata<GroupPermissionMetadata>() ?? [];
        return declared.Count == 1
            ? declared[0].Permission
            : throw new InvalidOperationException("A group endpoint must declare exactly one permission.");
    }

    private static async Task<Result<GroupAccess>> ResolveAsync(HttpContext http, GroupPermission permission)
    {
        var cancellationToken = http.RequestAborted;
        var user = await http.RequestServices.GetRequiredService<ICurrentUser>().GetAsync(cancellationToken).ConfigureAwait(false);
        if (user.IsFailure)
        {
            return Result.Failure<GroupAccess>(user.Error);
        }

        if (!Guid.TryParse(http.Request.RouteValues[GroupIdRouteValue] as string, out var id))
        {
            return Result.Failure<GroupAccess>(GroupErrors.GroupNotFound);
        }

        var group = new GroupId(id);
        var caller = new UserId(user.Value.UserId);
        var member = await http.RequestServices.GetRequiredService<IGroupStore>()
            .FindActiveMemberAsync(group, caller, cancellationToken).ConfigureAwait(false);
        return Authorize(group, caller, member, permission);
    }

    private static Result<GroupAccess> Authorize(GroupId group, UserId caller, GroupMember? member, GroupPermission permission)
    {
        if (member is null)
        {
            return Result.Failure<GroupAccess>(GroupErrors.GroupNotFound);
        }

        return RolePermissions.Allows(member.Role, permission)
            ? Result.Success(new GroupAccess(group, member, caller))
            : Result.Failure<GroupAccess>(GroupErrors.Forbidden);
    }
}
