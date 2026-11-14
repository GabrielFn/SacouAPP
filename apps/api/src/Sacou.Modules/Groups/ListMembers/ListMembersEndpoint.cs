using Sacou.Shared.Members;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Identity.Contracts;
using ContractRole = Sacou.Modules.Groups.Contracts.GroupRole;
using ContractType = Sacou.Modules.Groups.Contracts.MemberType;

namespace Sacou.Modules.Groups.ListMembers;

/// <summary>
/// <c>GET /v1/groups/{groupId}/members</c>: active members only, with the nickname and positions of their profile,
/// read from Identity in one call (ADR 0051, D5). No user id, subject or e-mail, and no level of any kind, for any
/// role: the note and the suggestion leave only through the admin's level route (ADR 0051, D7).
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
        HttpContext context, IGroupStore store, IPlayerProfiles profiles, CancellationToken cancellationToken)
    {
        var access = context.GroupAccess();
        var members = await store.ListActiveMembersAsync(access.GroupId, cancellationToken).ConfigureAwait(false);
        Guid[] users = [.. members.Where(member => member.UserId is not null).Select(member => member.UserId!.Value.Value)];
        var byUser = (await profiles.FindManyAsync(users, cancellationToken).ConfigureAwait(false)).ToDictionary(profile => profile.UserId);
        IReadOnlyList<MemberResponse> body = [.. members.Select(member => MemberResponse.From(member, access.Member.Id, ProfileOf(member, byUser)))];
        return TypedResults.Ok(body);
    }

    private static PlayerProfileView? ProfileOf(GroupMember member, Dictionary<Guid, PlayerProfileView> byUser) =>
        member.UserId is { } user && byUser.TryGetValue(user.Value, out var profile) ? profile : null;
}

/// <summary>
/// One member. Without a profile (a guest, or someone who skipped screen 27), the nickname and the main position
/// are null and the other positions empty. Exactly these nine fields: a test fails on a tenth.
/// </summary>
internal sealed record MemberResponse(
    Guid MemberId,
    ContractRole Role,
    ContractType MemberType,
    bool HasAccount,
    bool IsMe,
    DateTimeOffset JoinedAt,
    string? Nickname,
    PrimaryPosition? PrimaryPosition,
    IReadOnlyList<PlayingPosition> OtherPositions)
{
    public static MemberResponse From(GroupMember member, MemberId caller, PlayerProfileView? profile) => new(
        member.Id.Value,
        ContractValues.ToContract(member.Role),
        ContractValues.ToContract(member.Type),
        member.UserId is not null,
        member.Id == caller,
        member.JoinedAt,
        profile?.Nickname,
        profile?.PrimaryPosition,
        profile?.OtherPositions ?? []);
}
