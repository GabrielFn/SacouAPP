using Sacou.Modules.Groups.Domain.Guests;
using Sacou.Modules.Groups.Domain.Levels;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Shared.Levels;
using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Domain.Groups;

/// <summary>
/// The rules about guests without an account (ADR 0053), judged on the aggregate loaded under the group lock, as
/// every member write (ADR 0040, D8): an actor demoted after the access filter loses. A guest is a common member
/// (player, drop-in, active, no user id) whose name lives apart, in its own row.
/// </summary>
internal sealed partial record Group
{
    /// <summary>
    /// Adds a guest, or answers with the one an earlier request with the same <paramref name="requestId"/> created:
    /// a resend changes nothing, even with another name (D5). Order: the actor, the permission, the resend, the
    /// member limit (guests and accounts count together, D11). A <paramref name="level"/> is written in the same
    /// change; null leaves the guest unreviewed, and the draw uses 3,0 (D6).
    /// </summary>
    public Result<GuestAdmission> AddGuest(
        MemberId actorId, Guid requestId, GuestProfile profile, SkillLevel? level, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(profile);
        var actor = FindActive(actorId);
        if (actor is null)
        {
            return Result.Failure<GuestAdmission>(GroupErrors.GroupNotFound);
        }

        var mayAdd = RolePermissions.Allows(actor.Role, GroupPermission.ManageGuests)
            && (level is null || RolePermissions.Allows(actor.Role, GroupPermission.ManageMemberLevels));
        if (!mayAdd)
        {
            return Result.Failure<GuestAdmission>(GroupErrors.Forbidden);
        }

        var earlier = Guests.SingleOrDefault(guest => guest.RequestId == requestId);
        if (earlier is not null)
        {
            return Result.Success(new GuestAdmission(earlier, Created: false, Unchanged().Value));
        }

        var admitted = GroupLimits.CanTakeAnotherMember(ActiveMembers.Count());
        if (admitted.IsFailure)
        {
            return Result.Failure<GuestAdmission>(admitted.Error);
        }

        var member = GroupMember.Guest(now);
        var guest = new Guest(member.Id, profile, requestId, now);
        var change = new GroupChange(this with { Members = Members.Add(member), Guests = Guests.Add(guest) }, [member])
        {
            ChangedGuests = [guest],
            NewLevels = level is null ? [] : [new MemberLevel(member.Id, Id, level, actor.Id, now)],
        };
        return Result.Success(new GuestAdmission(guest, Created: true, change));
    }

    /// <summary>
    /// Replaces an active guest's name and position (D9). A target with an account, removed or of another group is the
    /// same <c>groups.member-not-found</c>. The same values again are a success that writes nothing.
    /// </summary>
    public Result<GroupChange> CorrectGuest(MemberId actorId, MemberId targetId, GuestProfile profile)
    {
        ArgumentNullException.ThrowIfNull(profile);
        var actor = FindActive(actorId);
        if (actor is null)
        {
            return Result.Failure<GroupChange>(GroupErrors.GroupNotFound);
        }

        if (!RolePermissions.Allows(actor.Role, GroupPermission.ManageGuests))
        {
            return Result.Failure<GroupChange>(GroupErrors.Forbidden);
        }

        var guest = FindActive(targetId) is { HasAccount: false } ? Guests.SingleOrDefault(known => known.MemberId == targetId) : null;
        if (guest is null)
        {
            return Result.Failure<GroupChange>(GroupErrors.MemberNotFound);
        }

        var corrected = guest with { Profile = profile };
        return corrected == guest
            ? Unchanged()
            : Result.Success(new GroupChange(this with { Guests = Guests.Replace(guest, corrected) }, []) { ChangedGuests = [corrected] });
    }

    /// <summary>The guest's profile row goes with the removal: the history keeps only the member id (D9, question 44).</summary>
    private static GroupChange ForgetGuest(GroupChange removal, MemberId guestId) => removal with
    {
        Group = removal.Group with { Guests = removal.Group.Guests.RemoveAll(guest => guest.MemberId == guestId) },
        RemovedGuests = [guestId],
    };
}

/// <summary>The guest a request found or created, and what the store writes: nothing when <see cref="Created"/> is false.</summary>
internal sealed record GuestAdmission(Guest Guest, bool Created, GroupChange Change);
