using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Guests;
using Sacou.Modules.Groups.Domain.Invites;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Domain.Settings;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>A group the person is an active member of, with that membership.</summary>
internal sealed record MemberGroup(GroupId GroupId, GroupName Name, GroupMember Member);

/// <summary>An active member and, for a guest without an account, the name and position the admin typed (ADR 0053, D10).</summary>
internal sealed record RosterEntry(GroupMember Member, GuestProfile? Guest);

/// <summary>What the group detail shows besides the caller's membership.</summary>
internal sealed record GroupOverview(GroupId GroupId, GroupName Name, int ActiveMembers);

/// <summary>What the invite preview shows: the invite, to check it is still valid, and the group it opens.</summary>
internal sealed record InvitePreview(GroupInvite Invite, GroupName GroupName, int ActiveMembers, bool AlreadyMember);

/// <summary>An acceptance: the invite the token found, if any (for the log, never the token), and what happened.</summary>
internal sealed record InviteAttempt(InviteId? InviteId, Result<GroupChange> Change);

/// <summary>
/// Where groups live. Every read that a route uses goes by the group id from the route and, for a member,
/// by <c>(group_id, id)</c> or <c>(group_id, user_id)</c>: never by a bare id (ADR 0040, D7).
/// </summary>
internal interface IGroupStore
{
    /// <summary>
    /// Counts the creator's active groups and inserts the group with its founder, in one transaction that
    /// holds a per-person lock, so two concurrent creations cannot both pass <paramref name="admission"/>.
    /// The group's first settings go in the same transaction, so a group never exists without them.
    /// </summary>
    Task<Result> CreateAsync(
        Group group, UserId creator, Func<int, Result> admission, StoredSettings settings, CancellationToken cancellationToken);

    /// <summary>Active memberships only, in the order the person joined.</summary>
    Task<IReadOnlyList<MemberGroup>> ListActiveGroupsAsync(UserId user, CancellationToken cancellationToken);

    /// <summary>The person's active member in that group, or null for a missing group, a non-member, a left or a removed member.</summary>
    Task<GroupMember?> FindActiveMemberAsync(GroupId group, UserId user, CancellationToken cancellationToken);

    Task<GroupOverview?> FindOverviewAsync(GroupId group, CancellationToken cancellationToken);

    /// <summary>Active members only, in the order they joined.</summary>
    Task<IReadOnlyList<GroupMember>> ListActiveMembersAsync(GroupId group, CancellationToken cancellationToken);

    /// <summary>Active members only, in the order they joined, each guest with its profile, in one query.</summary>
    Task<IReadOnlyList<RosterEntry>> ListActiveRosterAsync(GroupId group, CancellationToken cancellationToken);

    /// <summary>
    /// Renames only while <paramref name="renamer"/> is still an active member whose role may rename, checked
    /// in the same UPDATE: a demotion that lands after the access filter wins. False when nothing changed.
    /// </summary>
    Task<bool> RenameAsync(GroupId group, UserId renamer, GroupName name, CancellationToken cancellationToken);

    /// <summary>
    /// Every write that changes members (ADR 0040, D8): one transaction that starts with
    /// <c>SELECT ... FOR UPDATE</c> on the group row, loads the whole aggregate, applies
    /// <paramref name="change"/> and writes the members it changed. Writes of one group run one after another,
    /// so two admins demoting each other cannot both pass the last-admin rule. A missing group is
    /// <c>groups.group-not-found</c>; a failed change writes nothing. The aggregate holds the invites too, and
    /// every member and invite the change returns is written whole, new or changed, under the same lock.
    /// </summary>
    Task<Result<GroupChange>> ExecuteInGroupLockAsync(GroupId group, Func<Group, Result<GroupChange>> change, CancellationToken cancellationToken);

    /// <summary>
    /// The acceptance, in one transaction: the invite by its hash (none: <c>groups.invite-invalid</c>), then
    /// the group lock, then the per-person lock (group before person, ADR 0040, D7), the person's active
    /// groups, and <paramref name="accept"/> on the locked aggregate. The member is written only here.
    /// </summary>
    Task<InviteAttempt> AcceptInviteAsync(
        InviteTokenHash tokenHash, UserId person, Func<Group, InviteId, int, Result<GroupChange>> accept, CancellationToken cancellationToken);

    /// <summary>The invites still valid at <paramref name="now"/>, oldest first.</summary>
    Task<IReadOnlyList<GroupInvite>> ListValidInvitesAsync(GroupId group, DateTimeOffset now, CancellationToken cancellationToken);

    /// <summary>The invite with that hash and its group, without a lock; null when no invite has it.</summary>
    Task<InvitePreview?> FindInvitePreviewAsync(InviteTokenHash tokenHash, UserId person, CancellationToken cancellationToken);
}
