namespace Sacou.Modules.Groups.Domain.Members;

/// <summary>
/// A person in a group (glossary: "Membro do grupo"). <see cref="UserId"/> is null only for a guest without
/// an account (E3.5). <see cref="LeftAt"/> is set exactly when the member is not active. A member who leaves
/// or is removed keeps the row and the role it had, for the history; coming back is always as a player (part 3).
/// </summary>
internal sealed record GroupMember(
    MemberId Id,
    UserId? UserId,
    GroupRole Role,
    MemberType Type,
    MembershipStatus Status,
    DateTimeOffset JoinedAt,
    DateTimeOffset? LeftAt)
{
    public bool IsActive => Status == MembershipStatus.Active;

    public bool IsActiveAdmin => IsActive && Role == GroupRole.Admin;

    public bool HasAccount => UserId is not null;

    public static GroupMember Founder(UserId user, DateTimeOffset now) =>
        new(MemberId.New(now), user, GroupRole.Admin, MemberType.DropIn, MembershipStatus.Active, now, LeftAt: null);

    public GroupMember Leave(DateTimeOffset now) => this with { Status = MembershipStatus.Left, LeftAt = now };

    public GroupMember Remove(DateTimeOffset now) => this with { Status = MembershipStatus.Removed, LeftAt = now };
}
