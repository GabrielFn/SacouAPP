using Sacou.Shared.Members;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Members;

namespace Sacou.Modules.Groups.Tests.Domain;

/// <summary>A group in memory with the members a test asks for, each a new person, all drop-in.</summary>
internal sealed class GroupBuilder
{
    public static readonly DateTimeOffset Now = new(2026, 11, 9, 14, 30, 15, TimeSpan.Zero);

    private GroupBuilder(Group group) => Group = group;

    public Group Group { get; private set; }

    public GroupMember Founder => Group.Members[0];

    /// <summary>The founder is an admin, as every group starts.</summary>
    public static GroupBuilder WithFounder() =>
        new(Group.Create(GroupName.Create("Racha").Value, new UserId(Guid.NewGuid()), Now));

    public GroupMember Add(GroupRole role, MembershipStatus status = MembershipStatus.Active, bool hasAccount = true)
    {
        var member = new GroupMember(
            MemberId.New(Now),
            hasAccount ? new UserId(Guid.NewGuid()) : null,
            role,
            MemberType.DropIn,
            status,
            Now,
            status == MembershipStatus.Active ? null : Now);
        Group = Group with { Members = Group.Members.Add(member) };
        return member;
    }

    public GroupMember Member(MemberId id) => Group.Members.Single(member => member.Id == id);

    /// <summary>After a change the test applied on purpose, such as a new invite.</summary>
    public void Replace(Group group) => Group = group;

    /// <summary>The member with the same id, changed by hand.</summary>
    public void Replace(GroupMember member) => Group = Group with { Members = Group.Members.Replace(Member(member.Id), member) };
}

/// <summary>Public twins of the internal domain enums, so they can be theory parameters; converted by name.</summary>
public enum Role
{
    Admin,
    CoAdmin,
    Scorekeeper,
    Player,
}

public enum Status
{
    Active,
    Left,
    Removed,
}

internal static class TestEnums
{
    public static GroupRole ToDomain(this Role role) => Enum.Parse<GroupRole>(role.ToString());

    public static MembershipStatus ToDomain(this Status status) => Enum.Parse<MembershipStatus>(status.ToString());
}
