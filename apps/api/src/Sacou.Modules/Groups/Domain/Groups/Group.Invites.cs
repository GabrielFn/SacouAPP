using Sacou.Shared.Members;
using System.Collections.Immutable;
using Sacou.Modules.Groups.Domain.Invites;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Domain.Groups;

/// <summary>
/// The invite rules (ADR 0040, D10; docs/dominio/grupos.md), judged on the aggregate the store loads under
/// the group lock: a revocation and an acceptance of the same link never pass each other.
/// </summary>
internal sealed partial record Group
{
    public Result<GroupChange> CreateInvite(MemberId actorId, InviteId id, InviteTokenHash tokenHash, DateTimeOffset now)
    {
        var actor = FindInviteManager(actorId);
        if (actor.IsFailure)
        {
            return Result.Failure<GroupChange>(actor.Error);
        }

        if (Invites.Count(invite => invite.IsValidAt(now)) >= InviteRules.MaxActiveInvites)
        {
            return Result.Failure<GroupChange>(GroupErrors.InviteLimit);
        }

        var created = GroupInvite.Create(id, tokenHash, actor.Value.Id, now);
        return Result.Success(new GroupChange(this with { Invites = Invites.Add(created) }, []) { ChangedInvites = [created] });
    }

    /// <summary>Revoking an invite that is already revoked, or expired, is a success: the link is dead either way.</summary>
    public Result<GroupChange> RevokeInvite(MemberId actorId, InviteId inviteId, DateTimeOffset now)
    {
        var actor = FindInviteManager(actorId);
        if (actor.IsFailure)
        {
            return Result.Failure<GroupChange>(actor.Error);
        }

        var invite = Invites.SingleOrDefault(candidate => candidate.Id == inviteId);
        if (invite is null)
        {
            return Result.Failure<GroupChange>(GroupErrors.InviteNotFound);
        }

        return invite.IsRevoked ? Unchanged() : Result.Success(WithInvites([invite.Revoke(now)], []));
    }

    /// <summary>
    /// Order: the invite (valid now, else the one answer for every dead link), then the person. Already
    /// active: a success without effect, and no use counted. Removed: refused (Gabriel, question 19). Left
    /// or new: the ceilings, then in as a player, and the invite counts one use.
    /// </summary>
    public Result<GroupChange> Accept(InviteId inviteId, UserId person, int personActiveGroups, DateTimeOffset now)
    {
        var invite = Invites.SingleOrDefault(candidate => candidate.Id == inviteId);
        if (invite is null || !invite.IsValidAt(now))
        {
            return Result.Failure<GroupChange>(GroupErrors.InviteInvalid);
        }

        var joined = Join(person, personActiveGroups, now);
        return joined.IsFailure || joined.Value.ChangedMembers.IsEmpty
            ? joined
            : Result.Success(joined.Value.Group.WithInvites([invite.CountUse()], joined.Value.ChangedMembers));
    }

    /// <summary>
    /// The link of a round (E3.12, ADR 0070, D2): the same person rules as <see cref="Accept"/>, without an invite to
    /// check or to count. Already active: a success without effect. Removed: refused. Left or new: the ceilings, then
    /// in as a player and an avulso.
    /// </summary>
    public Result<GroupChange> JoinAsDropIn(UserId person, int personActiveGroups, DateTimeOffset now) =>
        Join(person, personActiveGroups, now);

    /// <summary>The person part of a way in: already in, removed, the ceilings, then in as a player and an avulso.</summary>
    private Result<GroupChange> Join(UserId person, int personActiveGroups, DateTimeOffset now)
    {
        var existing = Members.SingleOrDefault(member => member.UserId == person);
        if (existing is { IsActive: true })
        {
            return Unchanged();
        }

        if (existing is { Status: MembershipStatus.Removed })
        {
            return Result.Failure<GroupChange>(GroupErrors.MemberRemoved);
        }

        var admitted = Admit(personActiveGroups);
        if (admitted.IsFailure)
        {
            return Result.Failure<GroupChange>(admitted.Error);
        }

        var joined = existing is null ? GroupMember.Joining(person, now) : existing.Return(now);
        var members = existing is null ? Members.Add(joined) : Members.Replace(existing, joined);
        return Result.Success(new GroupChange(this with { Members = members }, [joined]));
    }

    private Result Admit(int personActiveGroups)
    {
        var seat = GroupLimits.CanTakeAnotherMember(ActiveMembers.Count());
        return seat.IsFailure ? seat : GroupLimits.CanJoinAnotherGroup(personActiveGroups);
    }

    private Result<GroupMember> FindInviteManager(MemberId actorId)
    {
        var actor = FindActive(actorId);
        if (actor is null)
        {
            return Result.Failure<GroupMember>(GroupErrors.GroupNotFound);
        }

        return RolePermissions.Allows(actor.Role, GroupPermission.ManageInvites)
            ? Result.Success(actor)
            : Result.Failure<GroupMember>(GroupErrors.Forbidden);
    }

    /// <summary>
    /// D1 of the plan: whoever no longer holds <c>ManageInvites</c> (left, removed, or now a scorekeeper or a
    /// player) loses their open invites, in the same transaction. An admin made co-admin keeps them.
    /// </summary>
    private static GroupChange RevokeInvitesOfPowerless(GroupChange change, GroupMember member, DateTimeOffset now)
    {
        if (member.IsActive && RolePermissions.Allows(member.Role, GroupPermission.ManageInvites))
        {
            return change;
        }

        ImmutableArray<GroupInvite> revoked =
            [.. change.Group.Invites.Where(invite => invite.CreatedBy == member.Id && invite.IsValidAt(now)).Select(invite => invite.Revoke(now))];
        return revoked.IsEmpty
            ? change
            : change.Group.WithInvites(revoked, change.ChangedMembers);
    }

    /// <summary>The group with <paramref name="changed"/> in place of the invites with the same ids, and what to write.</summary>
    private GroupChange WithInvites(ImmutableArray<GroupInvite> changed, ImmutableArray<GroupMember> changedMembers)
    {
        var invites = Invites.Select(invite => changed.FirstOrDefault(candidate => candidate.Id == invite.Id) ?? invite);
        return new GroupChange(this with { Invites = [.. invites] }, changedMembers) { ChangedInvites = changed };
    }
}
