using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Identity.Contracts;

namespace Sacou.Modules.Groups.ListMyGroups;

/// <summary><c>GET /v1/groups</c>: only the caller's active groups, in the order they joined. No search, no count of others.</summary>
internal static class ListMyGroupsEndpoint
{
    public const string Name = "ListMyGroups";

    public static IEndpointRouteBuilder MapListMyGroups(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet(GroupRouteExtensions.GroupsRoute, HandleAsync).WithName(Name).WithMetadata(GroupRouteExtensions.SmallBody());
        return endpoints;
    }

    private static async Task<Results<Ok<IReadOnlyList<MyGroupResponse>>, ProblemHttpResult>> HandleAsync(
        ICurrentUser currentUser, IGroupStore store, CancellationToken cancellationToken)
    {
        var user = await currentUser.GetAsync(cancellationToken).ConfigureAwait(false);
        if (user.IsFailure)
        {
            return ProblemResults.From(user.Error);
        }

        var groups = await store.ListActiveGroupsAsync(new(user.Value.UserId), cancellationToken).ConfigureAwait(false);
        IReadOnlyList<MyGroupResponse> body = [.. groups.Select(MyGroupResponse.From)];
        return TypedResults.Ok(body);
    }
}

internal sealed record MyGroupResponse(Guid GroupId, string Name, GroupRole Role, MemberType MemberType)
{
    public static MyGroupResponse From(MemberGroup group) => new(
        group.GroupId.Value,
        group.Name.Value,
        ContractValues.ToContract(group.Member.Role),
        ContractValues.ToContract(group.Member.Type));
}
