using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.GetGroup;

/// <summary><c>GET /v1/groups/{groupId}</c>: the group and the caller's own membership.</summary>
internal static class GetGroupEndpoint
{
    public const string Name = "GetGroup";

    public static RouteGroupBuilder MapGetGroup(this RouteGroupBuilder group)
    {
        group.MapGet(string.Empty, HandleAsync).WithName(Name).RequireGroupPermission(GroupPermission.ViewGroup);
        return group;
    }

    private static async Task<Results<Ok<GroupResponse>, ProblemHttpResult>> HandleAsync(
        HttpContext context, IGroupStore store, CancellationToken cancellationToken)
    {
        var access = context.GroupAccess();
        var overview = await store.FindOverviewAsync(access.GroupId, cancellationToken).ConfigureAwait(false);
        var found = overview is null
            ? Result.Failure<GroupResponse>(GroupErrors.GroupNotFound)
            : Result.Success(GroupResponse.From(overview, access));
        return found.ToHttpResult(body => TypedResults.Ok(body));
    }
}

internal sealed record GroupResponse(Guid GroupId, string Name, Guid MemberId, GroupRole Role, MemberType MemberType, int ActiveMembers)
{
    public static GroupResponse From(GroupOverview overview, GroupAccess access) => new(
        overview.GroupId.Value,
        overview.Name.Value,
        access.Member.Id.Value,
        ContractValues.ToContract(access.Member.Role),
        ContractValues.ToContract(access.Member.Type),
        overview.ActiveMembers);
}
