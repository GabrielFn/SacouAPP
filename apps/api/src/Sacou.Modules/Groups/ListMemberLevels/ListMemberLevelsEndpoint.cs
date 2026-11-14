using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Groups.Domain.Levels;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Identity.Contracts;

namespace Sacou.Modules.Groups.ListMemberLevels;

/// <summary>
/// <c>GET /v1/groups/{groupId}/member-levels</c>: the admin's level and the player's suggestion of each active
/// member, in the order they joined, for the admin and the co-admin only (ADR 0051, D7 and D8). The only route,
/// with the two writes, that answers a level of someone else: the member list never does.
/// </summary>
internal static class ListMemberLevelsEndpoint
{
    public const string Name = "ListMemberLevels";
    public const string Route = "/member-levels";

    public static RouteGroupBuilder MapListMemberLevels(this RouteGroupBuilder group)
    {
        group.MapGet(Route, HandleAsync).WithName(Name).RequireGroupPermission(GroupPermission.ManageMemberLevels);
        return group;
    }

    private static async Task<Ok<IReadOnlyList<MemberLevelResponse>>> HandleAsync(
        HttpContext context, IGroupStore store, IMemberLevelStore levels, IPlayerProfiles profiles, CancellationToken cancellationToken)
    {
        var access = context.GroupAccess();
        var members = await store.ListActiveMembersAsync(access.GroupId, cancellationToken).ConfigureAwait(false);
        var byMember = (await levels.ListAsync(access.GroupId, cancellationToken).ConfigureAwait(false)).ToDictionary(level => level.MemberId);
        var suggestions = await MemberSuggestions.FindAsync(profiles, members.Select(member => member.UserId), cancellationToken).ConfigureAwait(false);
        IReadOnlyList<MemberLevelResponse> body =
            [.. members.Select(member => MemberLevelResponse.From(member, byMember.GetValueOrDefault(member.Id), MemberSuggestions.Of(suggestions, member.UserId)))];
        return TypedResults.Ok(body);
    }
}

/// <summary>
/// One member. <see cref="Reviewed"/> false is "pending" (screen 19 counts them); true with a null
/// <see cref="AdminLevel"/> is "Não sei". Never the author nor the time of the level (minimization).
/// </summary>
internal sealed record MemberLevelResponse(Guid MemberId, decimal? AdminLevel, bool Reviewed, decimal? SuggestedLevel)
{
    public static MemberLevelResponse From(GroupMember member, MemberLevel? level, Shared.Levels.SkillLevel? suggestion) => new(
        member.Id.Value, level?.Level?.ToDecimal(), level is not null, suggestion?.ToDecimal());
}
