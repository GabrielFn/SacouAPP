using Sacou.Shared.Members;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Domain.Groups;

/// <summary>
/// The rules about the target member (ADR 0040, D9; docs/dominio/grupos.md). The actor is looked up in this
/// aggregate, which the store loads under the group lock: an actor demoted or removed after the access filter
/// is judged by what the database says now. Order: actor, target, permission for that target and value, the
/// value itself, and last the one rule over the whole group, that it never ends without an active admin.
/// A member who leaves, is removed or loses <c>ManageInvites</c> loses their open invites in the same change.
/// </summary>
internal sealed partial record Group
{
    public Result<GroupChange> ChangeRole(MemberId actorId, MemberId targetId, GroupRole role, DateTimeOffset now)
    {
        var pair = FindPair(actorId, targetId);
        if (pair.IsFailure)
        {
            return Result.Failure<GroupChange>(pair.Error);
        }

        var (actor, target) = pair.Value;
        var permission = target.Role.IsAdministrative() || role.IsAdministrative()
            ? GroupPermission.AssignAdminRole
            : GroupPermission.AssignBasicRole;
        if (!RolePermissions.Allows(actor.Role, permission))
        {
            return Result.Failure<GroupChange>(GroupErrors.Forbidden);
        }

        return target.Role == role ? Unchanged() : ReplaceAndRevokeInvites(target, target with { Role = role }, now);
    }

    public Result<GroupChange> ChangeMemberType(MemberId actorId, MemberId targetId, MemberType type)
    {
        var pair = FindPair(actorId, targetId);
        if (pair.IsFailure)
        {
            return Result.Failure<GroupChange>(pair.Error);
        }

        var (actor, target) = pair.Value;
        if (!RolePermissions.Allows(actor.Role, GroupPermission.ChangeMemberType))
        {
            return Result.Failure<GroupChange>(GroupErrors.Forbidden);
        }

        if (target.Type == type)
        {
            return Unchanged();
        }

        return type == MemberType.Regular && !target.HasAccount
            ? Result.Failure<GroupChange>(GroupErrors.RegularNeedsAccount)
            : Replace(target, target with { Type = type });
    }

    public Result<GroupChange> Remove(MemberId actorId, MemberId targetId, DateTimeOffset now)
    {
        var pair = FindPair(actorId, targetId);
        if (pair.IsFailure)
        {
            return Result.Failure<GroupChange>(pair.Error);
        }

        var (actor, target) = pair.Value;
        if (actor.Id == target.Id)
        {
            return Result.Failure<GroupChange>(GroupErrors.UseLeave);
        }

        var permission = target.Role.IsAdministrative() ? GroupPermission.RemoveAdmin : GroupPermission.RemoveMember;
        return RolePermissions.Allows(actor.Role, permission)
            ? ReplaceAndRevokeInvites(target, target.Remove(now), now)
            : Result.Failure<GroupChange>(GroupErrors.Forbidden);
    }

    public Result<GroupChange> Leave(MemberId actorId, DateTimeOffset now)
    {
        var actor = FindActive(actorId);
        if (actor is null)
        {
            return Result.Failure<GroupChange>(GroupErrors.GroupNotFound);
        }

        return RolePermissions.Allows(actor.Role, GroupPermission.Leave)
            ? ReplaceAndRevokeInvites(actor, actor.Leave(now), now)
            : Result.Failure<GroupChange>(GroupErrors.Forbidden);
    }

    /// <summary>
    /// An actor who is no longer active gets what any non-member gets; a target that is not active here, or
    /// is in another group, gets the same not-found as one that never existed.
    /// </summary>
    private Result<MemberPair> FindPair(MemberId actorId, MemberId targetId)
    {
        var actor = FindActive(actorId);
        if (actor is null)
        {
            return Result.Failure<MemberPair>(GroupErrors.GroupNotFound);
        }

        var target = FindActive(targetId);
        return target is null
            ? Result.Failure<MemberPair>(GroupErrors.MemberNotFound)
            : Result.Success(new MemberPair(actor, target));
    }

    private GroupMember? FindActive(MemberId id) => ActiveMembers.SingleOrDefault(member => member.Id == id);

    private Result<GroupChange> Unchanged() => Result.Success(new GroupChange(this, []));

    private Result<GroupChange> ReplaceAndRevokeInvites(GroupMember before, GroupMember after, DateTimeOffset now)
    {
        var replaced = Replace(before, after);
        return replaced.IsFailure ? replaced : Result.Success(RevokeInvitesOfPowerless(replaced.Value, after, now));
    }

    /// <summary>The one rule over the whole group: a change that takes away the last active admin is refused.</summary>
    private Result<GroupChange> Replace(GroupMember before, GroupMember after)
    {
        var losesLastAdmin = before.IsActiveAdmin && !after.IsActiveAdmin
            && !ActiveMembers.Any(member => member.IsActiveAdmin && member.Id != before.Id);
        if (losesLastAdmin)
        {
            return Result.Failure<GroupChange>(GroupErrors.LastAdmin);
        }

        var group = this with { Members = Members.Replace(before, after) };
        return Result.Success(new GroupChange(group, [after]));
    }

    private sealed record MemberPair(GroupMember Actor, GroupMember Target);
}
