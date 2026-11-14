using Sacou.Shared.Members;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.Net.Http.Headers;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Groups.Domain.Guests;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Identity.Contracts;
using ContractRole = Sacou.Modules.Groups.Contracts.GroupRole;
using ContractType = Sacou.Modules.Groups.Contracts.MemberType;

namespace Sacou.Modules.Groups.ListMembers;

/// <summary>
/// <c>GET /v1/groups/{groupId}/members</c>: active members only, with the nickname and positions of their profile,
/// read from Identity in one call (ADR 0051, D5); a guest without an account shows the name and position the admin
/// typed, read in the same query as the members (ADR 0053, D10). No user id, subject or e-mail, and no level of any kind, for any
/// role: the note and the suggestion leave only through the admin's level route (ADR 0051, D7).
/// </summary>
internal static class ListMembersEndpoint
{
    public const string Name = "ListGroupMembers";
    public const string Route = "/members";

    private const string NoStore = "no-store";

    public static RouteGroupBuilder MapListMembers(this RouteGroupBuilder group)
    {
        group.MapGet(Route, HandleAsync).WithName(Name).RequireGroupPermission(GroupPermission.ViewGroup);
        return group;
    }

    private static async Task<Ok<IReadOnlyList<MemberResponse>>> HandleAsync(
        HttpContext context, IGroupStore store, IPlayerProfiles profiles, CancellationToken cancellationToken)
    {
        // The list carries names, a guest's among them: no cache along the way keeps it (ADR 0053, D10).
        context.Response.Headers[HeaderNames.CacheControl] = NoStore;
        var access = context.GroupAccess();
        var roster = await store.ListActiveRosterAsync(access.GroupId, cancellationToken).ConfigureAwait(false);
        Guid[] users = [.. roster.Select(entry => entry.Member.UserId).OfType<UserId>().Select(user => user.Value)];
        var byUser = (await profiles.FindManyAsync(users, cancellationToken).ConfigureAwait(false)).ToDictionary(profile => profile.UserId);
        IReadOnlyList<MemberResponse> body = [.. roster.Select(entry => ToResponse(entry, access.Member.Id, byUser))];
        return TypedResults.Ok(body);
    }

    /// <summary>A guest's profile is what the admin typed; anyone else's comes from Identity, if they saved one.</summary>
    private static MemberResponse ToResponse(RosterEntry entry, MemberId caller, Dictionary<Guid, PlayerProfileView> byUser) =>
        entry is { Member.UserId: null, Guest: { } guest }
            ? MemberResponse.FromGuest(entry.Member, caller, guest)
            : MemberResponse.From(entry.Member, caller, entry.Member.UserId is { } user ? byUser.GetValueOrDefault(user.Value) : null);
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

    /// <summary>A guest without an account: the name the admin typed, its one position and no other (ADR 0053, D10).</summary>
    public static MemberResponse FromGuest(GroupMember member, MemberId caller, GuestProfile guest) =>
        From(member, caller, profile: null) with
        {
            Nickname = guest.Name.Value,
            PrimaryPosition = guest.Position is { } position ? ContractValues.ToPrimary(position) : null,
        };
}
