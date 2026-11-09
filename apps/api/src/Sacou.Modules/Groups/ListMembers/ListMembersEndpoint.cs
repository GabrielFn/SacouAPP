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
using ContractType = Sacou.Modules.Groups.Contracts.MemberType;

namespace Sacou.Modules.Groups.ListMembers;

/// <summary>
/// <c>GET /v1/groups/{groupId}/members</c>: active members only. No user id, subject, e-mail or name: names
/// come from the profile (E3.17), by member id (D9).
/// </summary>
internal static class ListMembersEndpoint
{
    public const string Name = "ListGroupMembers";
    public const string Route = "/members";

    public static RouteGroupBuilder MapListMembers(this RouteGroupBuilder group)
    {
        group.MapGet(Route, HandleAsync).WithName(Name).RequireGroupPermission(GroupPermission.ViewGroup);
        return group;
    }

    private static async Task<Ok<IReadOnlyList<MemberResponse>>> HandleAsync(
        HttpContext context, IGroupStore store, CancellationToken cancellationToken)
    {
        var access = context.GroupAccess();
        var members = await store.ListActiveMembersAsync(access.GroupId, cancellationToken).ConfigureAwait(false);
        IReadOnlyList<MemberResponse> body = [.. members.Select(member => MemberResponse.From(member, access.Member.Id))];
        return TypedResults.Ok(body);
    }
}

internal sealed record MemberResponse(Guid MemberId, ContractRole Role, ContractType MemberType, bool HasAccount, bool IsMe, DateTimeOffset JoinedAt)
{
    public static MemberResponse From(GroupMember member, MemberId caller) => new(
        member.Id.Value,
        ContractValues.ToContract(member.Role),
        ContractValues.ToContract(member.Type),
        member.UserId is not null,
        member.Id == caller,
        member.JoinedAt);
}
