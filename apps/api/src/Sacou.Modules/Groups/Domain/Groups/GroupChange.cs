using System.Collections.Immutable;
using Sacou.Shared.Members;
using Sacou.Modules.Groups.Domain.Guests;
using Sacou.Modules.Groups.Domain.Invites;
using Sacou.Modules.Groups.Domain.Levels;
using Sacou.Modules.Groups.Domain.Members;

namespace Sacou.Modules.Groups.Domain.Groups;

/// <summary>
/// What a write did to the aggregate: the group after the change and the members and invites whose rows the
/// store writes, new or changed. Nothing to write means a success without effect, such as setting a role it
/// already has. A guest's profile is written, new or changed, or deleted when the guest is removed (ADR 0053, D9);
/// a guest created with a level brings its first level row, written in the same transaction (D6).
/// </summary>
internal sealed record GroupChange(Group Group, ImmutableArray<GroupMember> ChangedMembers)
{
    public ImmutableArray<GroupInvite> ChangedInvites { get; init; } = [];

    public ImmutableArray<Guest> ChangedGuests { get; init; } = [];

    public ImmutableArray<MemberId> RemovedGuests { get; init; } = [];

    public ImmutableArray<MemberLevel> NewLevels { get; init; } = [];

    public bool IsEmpty => ChangedMembers.IsEmpty && ChangedInvites.IsEmpty && ChangedGuests.IsEmpty && RemovedGuests.IsEmpty && NewLevels.IsEmpty;
}
