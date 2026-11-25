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

/// <summary>One membership of the person, in any status, with the group's current name (E3.16: the personal data export).</summary>
internal sealed record AccountMembership(GroupId GroupId, GroupName GroupName, GroupMember Member);

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
    /// <paramref name="stillRegistered"/> runs right after the person's lock, so an account deleted since the request
    /// resolved the creator is refused instead of linked (ADR 0056, D7).
    /// </summary>
    Task<Result> CreateAsync(
        Group group,
        UserId creator,
        Func<CancellationToken, Task<Result>> stillRegistered,
        Func<int, Result> admission,
        StoredSettings settings,
        CancellationToken cancellationToken);

    /// <summary>Active memberships only, in the order the person joined.</summary>
    Task<IReadOnlyList<MemberGroup>> ListActiveGroupsAsync(UserId user, CancellationToken cancellationToken);

    /// <summary>Every membership of the person, active, left and removed, in the order they joined (E3.16).</summary>
    Task<IReadOnlyList<AccountMembership>> ListMembershipsOfUserAsync(UserId user, CancellationToken cancellationToken);

    /// <summary>
    /// The groups where the person is an active admin, each with all its members and without a lock, for the
    /// deletion rule (E3.16, ADR 0056, D3). Only the members are loaded: the invites and the guests stay empty.
    /// </summary>
    Task<IReadOnlyList<Group>> ListGroupsWhereActiveAdminAsync(UserId user, CancellationToken cancellationToken);

    /// <summary>
    /// The account deletion in this module (E3.16, ADR 0056, D7), in one transaction: every group the person has a
    /// member in (any status), locked with <c>FOR UPDATE</c> in ascending id order, then the per-person lock (group
    /// before person, ADR 0040, D7). The groups where <paramref name="isBlocker"/> holds come back and nothing is
    /// written; otherwise <paramref name="erase"/> runs on each locked aggregate, the rows it changed are written and
    /// the levels <em>about</em> the person's members are deleted (the ones they gave stay), with the reports by and about them (E6.6). Empty when it ran.
    /// </summary>
    Task<IReadOnlyList<GroupId>> EraseAccountAsync(
        UserId user, Func<Group, bool> isBlocker, Func<Group, GroupChange> erase, CancellationToken cancellationToken);

    /// <summary>The person's active member in that group, or null for a missing group, a non-member, a left or a removed member.</summary>
    Task<GroupMember?> FindActiveMemberAsync(GroupId group, UserId user, CancellationToken cancellationToken);

    /// <summary>The ids among <paramref name="memberIds"/> with a member row in the group, any status, in one query.</summary>
    Task<IReadOnlySet<Guid>> FindMembersOfGroupAsync(GroupId group, IReadOnlyCollection<Guid> memberIds, CancellationToken cancellationToken);

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
    /// <paramref name="stillRegistered"/> runs right after the person's lock, as in <see cref="CreateAsync"/>.
    /// </summary>
    Task<InviteAttempt> AcceptInviteAsync(
        InviteTokenHash tokenHash,
        UserId person,
        Func<CancellationToken, Task<Result>> stillRegistered,
        Func<Group, InviteId, int, Result<GroupChange>> accept,
        CancellationToken cancellationToken);

    /// <summary>
    /// The way in by a round link (E3.12, ADR 0070, D2), with the transaction and the locks of
    /// <see cref="AcceptInviteAsync"/> and no invite: the group lock, the per-person lock, <paramref name="stillRegistered"/>,
    /// the person's active groups and <paramref name="join"/> on the locked aggregate. A missing group is
    /// <c>groups.group-not-found</c>.
    /// </summary>
    Task<Result<GroupChange>> JoinAsync(
        GroupId group,
        UserId person,
        Func<CancellationToken, Task<Result>> stillRegistered,
        Func<Group, int, Result<GroupChange>> join,
        CancellationToken cancellationToken);

    /// <summary>The invites still valid at <paramref name="now"/>, oldest first.</summary>
    Task<IReadOnlyList<GroupInvite>> ListValidInvitesAsync(GroupId group, DateTimeOffset now, CancellationToken cancellationToken);

    /// <summary>The invite with that hash and its group, without a lock; null when no invite has it.</summary>
    Task<InvitePreview?> FindInvitePreviewAsync(InviteTokenHash tokenHash, UserId person, CancellationToken cancellationToken);
}
