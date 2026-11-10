using System.Collections.Immutable;
using Sacou.Modules.Groups.Domain.Invites;
using Sacou.Modules.Groups.Domain.Members;

namespace Sacou.Modules.Groups.Domain.Groups;

/// <summary>
/// The group aggregate, with its members inside (<c>produto.md:260</c>). Immutable: every change returns a
/// new value. Members are never deleted, only marked as left or removed (ADR 0012, ADR 0040). The member
/// rules are in <c>Group.Members.cs</c>, the invite rules in <c>Group.Invites.cs</c>.
/// </summary>
internal sealed partial record Group(GroupId Id, GroupName Name, DateTimeOffset CreatedAt, ImmutableArray<GroupMember> Members)
{
    /// <summary>Whoever creates the group is its first admin: active, drop-in, with a new <see cref="MemberId"/>.</summary>
    public static Group Create(GroupName name, UserId creator, DateTimeOffset now) =>
        new(GroupId.New(now), name, now, [GroupMember.Founder(creator, now)]);

    /// <summary>Every invite of the group, revoked and expired ones too, so revoking twice is still a success.</summary>
    public ImmutableArray<GroupInvite> Invites { get; init; } = [];

    public IEnumerable<GroupMember> ActiveMembers => Members.Where(member => member.IsActive);

    /// <summary>The person's active member here, if any.</summary>
    public GroupMember? ActiveMemberOf(UserId person) => ActiveMembers.SingleOrDefault(member => member.UserId == person);
}
