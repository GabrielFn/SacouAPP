using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Members;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>Rows to the immutable domain and back, by hand (no AutoMapper).</summary>
internal static class RowMapping
{
    public static GroupRow ToRow(Group group) => new()
    {
        Id = group.Id.Value,
        Name = group.Name.Value,
        CreatedAt = group.CreatedAt,
    };

    public static MemberRow ToRow(GroupId group, GroupMember member) => new()
    {
        Id = member.Id.Value,
        GroupId = group.Value,
        UserId = member.UserId?.Value,
        Role = ColumnValues.Roles[member.Role],
        MemberType = ColumnValues.MemberTypes[member.Type],
        Status = ColumnValues.Statuses[member.Status],
        JoinedAt = member.JoinedAt,
        LeftAt = member.LeftAt,
    };

    public static GroupMember ToMember(MemberRow row) => new(
        new MemberId(row.Id),
        row.UserId is { } user ? new UserId(user) : null,
        ColumnValues.Parse(ColumnValues.Roles, row.Role),
        ColumnValues.Parse(ColumnValues.MemberTypes, row.MemberType),
        ColumnValues.Parse(ColumnValues.Statuses, row.Status),
        row.JoinedAt,
        row.LeftAt);

    /// <summary>Stored names passed the domain rule when written.</summary>
    public static GroupName ToName(string stored) => GroupName.Create(stored).Value;
}
