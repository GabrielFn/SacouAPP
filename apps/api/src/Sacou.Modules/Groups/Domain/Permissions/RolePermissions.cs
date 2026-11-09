using System.Collections.Immutable;
using Sacou.Modules.Groups.Domain.Members;

namespace Sacou.Modules.Groups.Domain.Permissions;

/// <summary>
/// The permission table, as data (ADR 0040). Gabriel's answer to question 16: the co-admin runs the day to
/// day but never promotes, demotes or removes an admin or co-admin. Rules about the target member live in
/// the aggregate.
/// </summary>
internal static class RolePermissions
{
    private static readonly ImmutableHashSet<GroupPermission> EveryMember =
        [GroupPermission.ViewGroup, GroupPermission.Leave];

    private static readonly ImmutableHashSet<GroupPermission> DayToDay = EveryMember.Union(
    [
        GroupPermission.RenameGroup,
        GroupPermission.ManageInvites,
        GroupPermission.ChangeMemberType,
        GroupPermission.AssignBasicRole,
        GroupPermission.RemoveMember,
    ]);

    private static readonly ImmutableHashSet<GroupPermission> Everything = DayToDay.Union(
        [GroupPermission.AssignAdminRole, GroupPermission.RemoveAdmin]);

    private static readonly ImmutableDictionary<GroupRole, ImmutableHashSet<GroupPermission>> Table =
        ImmutableDictionary<GroupRole, ImmutableHashSet<GroupPermission>>.Empty
            .Add(GroupRole.Admin, Everything)
            .Add(GroupRole.CoAdmin, DayToDay)
            .Add(GroupRole.Scorekeeper, EveryMember)
            .Add(GroupRole.Player, EveryMember);

    public static bool Allows(GroupRole role, GroupPermission permission) =>
        Table.TryGetValue(role, out var permissions) && permissions.Contains(permission);
}
