using System.Collections.Immutable;
using Sacou.Modules.Groups.Domain.Invites;
using Sacou.Modules.Groups.Domain.Members;

namespace Sacou.Modules.Groups.Domain.Groups;

/// <summary>
/// What a write did to the aggregate: the group after the change and the members and invites whose rows the
/// store writes, new or changed. Nothing to write means a success without effect, such as setting a role it
/// already has.
/// </summary>
internal sealed record GroupChange(Group Group, ImmutableArray<GroupMember> ChangedMembers)
{
    public ImmutableArray<GroupInvite> ChangedInvites { get; init; } = [];

    public bool IsEmpty => ChangedMembers.IsEmpty && ChangedInvites.IsEmpty;
}
