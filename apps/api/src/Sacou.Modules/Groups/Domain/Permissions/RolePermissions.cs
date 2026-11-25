using System.Collections.Immutable;
using Sacou.Modules.Groups.Domain.Members;

namespace Sacou.Modules.Groups.Domain.Permissions;

/// <summary>
/// The permission table, as data (ADR 0040). Gabriel's answer to question 16 (and 23, for the settings): the co-admin runs the day to
/// day but never promotes, demotes or removes an admin or co-admin. Rules about the target member live in
/// the aggregate.
/// </summary>
internal static class RolePermissions
{
    private static readonly ImmutableHashSet<GroupPermission> EveryMember =
        [GroupPermission.ViewGroup, GroupPermission.Leave, GroupPermission.RespondAttendance, GroupPermission.ReportContent];

    private static readonly ImmutableHashSet<GroupPermission> DayToDay = EveryMember.Union(
    [
        GroupPermission.RenameGroup,
        GroupPermission.ManageInvites,
        GroupPermission.ChangeMemberType,
        GroupPermission.AssignBasicRole,
        GroupPermission.RemoveMember,
        GroupPermission.ManageSettings,
        GroupPermission.ManageRounds,
        GroupPermission.ManageMemberLevels,
        GroupPermission.ManageGuests,
        GroupPermission.DrawTeams,
        GroupPermission.WriteCourt,
    ]);

    /// <summary>The scorekeeper marks the court on the phone (ADR 0046, decision 2) and nothing else of the day to day.</summary>
    private static readonly ImmutableHashSet<GroupPermission> Scorekeeping = EveryMember.Add(GroupPermission.WriteCourt);

    private static readonly ImmutableHashSet<GroupPermission> Everything = DayToDay.Union(
        [GroupPermission.AssignAdminRole, GroupPermission.RemoveAdmin]);

    private static readonly ImmutableDictionary<GroupRole, ImmutableHashSet<GroupPermission>> Table =
        ImmutableDictionary<GroupRole, ImmutableHashSet<GroupPermission>>.Empty
            .Add(GroupRole.Admin, Everything)
            .Add(GroupRole.CoAdmin, DayToDay)
            .Add(GroupRole.Scorekeeper, Scorekeeping)
            .Add(GroupRole.Player, EveryMember);

    public static bool Allows(GroupRole role, GroupPermission permission) =>
        Table.TryGetValue(role, out var permissions) && permissions.Contains(permission);
}
