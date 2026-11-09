namespace Sacou.Modules.Groups.Domain.Members;

/// <summary>
/// A person in a group (glossary: "Membro do grupo"). <see cref="UserId"/> is null only for a guest without
/// an account (E3.5). <see cref="LeftAt"/> is set exactly when the member is not active.
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

    public static GroupMember Founder(UserId user, DateTimeOffset now) =>
        new(MemberId.New(now), user, GroupRole.Admin, MemberType.DropIn, MembershipStatus.Active, now, LeftAt: null);
}
