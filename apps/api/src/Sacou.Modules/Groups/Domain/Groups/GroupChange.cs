using System.Collections.Immutable;
using Sacou.Modules.Groups.Domain.Members;

namespace Sacou.Modules.Groups.Domain.Groups;

/// <summary>
/// What a write did to the aggregate: the group after the change and the members whose rows the store
/// writes. No changed member means a success with nothing to write, such as setting a role it already has.
/// </summary>
internal sealed record GroupChange(Group Group, ImmutableArray<GroupMember> ChangedMembers)
{
    public bool IsEmpty => ChangedMembers.IsEmpty;
}
