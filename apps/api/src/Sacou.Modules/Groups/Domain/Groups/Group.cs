using System.Collections.Immutable;
using Sacou.Modules.Groups.Domain.Members;

namespace Sacou.Modules.Groups.Domain.Groups;

/// <summary>
/// The group aggregate, with its members inside (<c>produto.md:260</c>). Immutable: every change returns a
/// new value. Members are never deleted, only marked as left or removed (ADR 0012, ADR 0040). The member
/// rules are in <c>Group.Members.cs</c>.
/// </summary>
internal sealed partial record Group(GroupId Id, GroupName Name, DateTimeOffset CreatedAt, ImmutableArray<GroupMember> Members)
{
    /// <summary>Whoever creates the group is its first admin: active, drop-in, with a new <see cref="MemberId"/>.</summary>
    public static Group Create(GroupName name, UserId creator, DateTimeOffset now) =>
        new(GroupId.New(now), name, now, [GroupMember.Founder(creator, now)]);

    public IEnumerable<GroupMember> ActiveMembers => Members.Where(member => member.IsActive);
}
