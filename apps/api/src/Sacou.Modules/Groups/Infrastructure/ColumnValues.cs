using System.Collections.Immutable;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Domain.Permissions;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>
/// The text each enum value has in the database, written by hand so reordering or renaming an enum never
/// changes stored data. The CHECK constraints are built from the same lists.
/// </summary>
internal static class ColumnValues
{
    public static readonly ImmutableDictionary<GroupRole, string> Roles = ImmutableDictionary<GroupRole, string>.Empty
        .Add(GroupRole.Admin, "admin")
        .Add(GroupRole.CoAdmin, "co_admin")
        .Add(GroupRole.Scorekeeper, "scorekeeper")
        .Add(GroupRole.Player, "player");

    public static readonly ImmutableDictionary<MemberType, string> MemberTypes = ImmutableDictionary<MemberType, string>.Empty
        .Add(MemberType.Regular, "regular")
        .Add(MemberType.DropIn, "drop_in");

    public static readonly ImmutableDictionary<MembershipStatus, string> Statuses = ImmutableDictionary<MembershipStatus, string>.Empty
        .Add(MembershipStatus.Active, "active")
        .Add(MembershipStatus.Left, "left")
        .Add(MembershipStatus.Removed, "removed");

    public static string ActiveStatus => Statuses[MembershipStatus.Active];

    /// <summary>The stored roles that hold <paramref name="permission"/>, from the permission table, for a check inside SQL.</summary>
    public static IReadOnlyList<string> RolesWith(GroupPermission permission) =>
        [.. Roles.Where(pair => RolePermissions.Allows(pair.Key, permission)).Select(pair => pair.Value).Order(StringComparer.Ordinal)];

    public static TEnum Parse<TEnum>(ImmutableDictionary<TEnum, string> values, string text)
        where TEnum : struct, Enum =>
        values.Single(pair => pair.Value == text).Key;

    /// <summary>The SQL list for a CHECK, such as <c>'admin', 'co_admin'</c>, in a fixed order.</summary>
    public static string SqlList<TEnum>(ImmutableDictionary<TEnum, string> values)
        where TEnum : struct, Enum =>
        string.Join(", ", values.Values.Order(StringComparer.Ordinal).Select(value => $"'{value}'"));
}
