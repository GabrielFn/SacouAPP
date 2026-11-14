using Sacou.Shared.Members;
using Sacou.Shared.Persistence;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Guests;
using Sacou.Modules.Groups.Domain.Invites;
using Sacou.Modules.Groups.Domain.Levels;
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
        EnumColumns.Parse(ColumnValues.Roles, row.Role),
        EnumColumns.Parse(ColumnValues.MemberTypes, row.MemberType),
        EnumColumns.Parse(ColumnValues.Statuses, row.Status),
        row.JoinedAt,
        row.LeftAt);

    public static GuestRow ToRow(GroupId group, Guest guest) => new()
    {
        MemberId = guest.MemberId.Value,
        GroupId = group.Value,
        Name = guest.Profile.Name.Value,
        PrimaryPosition = guest.Profile.Position is { } position ? GuestPositions.Names[position] : null,
        RequestId = guest.RequestId,
        CreatedAt = guest.CreatedAt,
    };

    public static Guest ToGuest(GuestRow row) => new(new MemberId(row.MemberId), ToGuestProfile(row), row.RequestId, row.CreatedAt);

    public static GuestProfile ToGuestProfile(GuestRow row) => new(
        GuestName.FromStored(row.Name),
        row.PrimaryPosition is { } position ? EnumColumns.Parse(GuestPositions.Names, position) : null);

    public static MemberLevelRow ToRow(MemberLevel level) => new()
    {
        MemberId = level.MemberId.Value,
        GroupId = level.GroupId.Value,
        LevelTenths = level.Level is { } value ? checked((short)value.Tenths) : null,
        SetByMemberId = level.SetBy.Value,
        SetAt = level.SetAt,
    };

    public static InviteRow ToRow(GroupId group, GroupInvite invite) => new()
    {
        Id = invite.Id.Value,
        GroupId = group.Value,
        TokenHash = [.. invite.TokenHash.Bytes],
        CreatedByMemberId = invite.CreatedBy.Value,
        CreatedAt = invite.CreatedAt,
        ExpiresAt = invite.ExpiresAt,
        RevokedAt = invite.RevokedAt,
        UseCount = invite.UseCount,
    };

    public static GroupInvite ToInvite(InviteRow row) => new(
        new InviteId(row.Id),
        InviteTokenHash.From(row.TokenHash),
        new MemberId(row.CreatedByMemberId),
        row.CreatedAt,
        row.ExpiresAt,
        row.RevokedAt,
        row.UseCount);

    /// <summary>Trusted: a name that a later, stricter rule refuses is still shown, never a 500.</summary>
    public static GroupName ToName(string stored) => GroupName.FromStored(stored);
}
