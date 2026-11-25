using System.Collections.Immutable;
using Sacou.Modules.Groups.Domain.Invites;
using Sacou.Modules.Groups.Domain.Members;

namespace Sacou.Modules.Groups.Domain.Groups;

/// <summary>
/// The account deletion seen from one group (E3.16, ADR 0056, D1 and D2): the person becomes a former player. The
/// member row stays with its id and its role, for the history, but without the user id; an active member leaves now,
/// a member who left or was removed keeps that status and date. The person's open invites die with the account.
/// </summary>
internal sealed partial record Group
{
    /// <summary>
    /// Never refused: the deletion rule (<see cref="DeletionRules"/>) was judged before, under the same lock, so the only
    /// admin may go when no one with an account is left to take over. When the person was the last active member with
    /// an account, the guests' names go too: no one is left to see or correct them (Gabriel, question 64); their member
    /// ids stay. A person who is not here, or is here only as a former player, changes nothing.
    /// </summary>
    public GroupChange EraseAccount(UserId person, DateTimeOffset now)
    {
        var member = Members.SingleOrDefault(candidate => candidate.UserId == person);
        if (member is null)
        {
            return new GroupChange(this, []);
        }

        var erased = (member.IsActive ? member.Leave(now) : member) with { UserId = null };
        var group = this with { Members = Members.Replace(member, erased) };
        ImmutableArray<GroupInvite> revoked =
            [.. Invites.Where(invite => invite.CreatedBy == member.Id && invite.IsValidAt(now)).Select(invite => invite.Revoke(now))];
        var change = revoked.IsEmpty ? new GroupChange(group, [erased]) : group.WithInvites(revoked, [erased]);
        return member.IsActive && !group.ActiveMembers.Any(candidate => candidate.HasAccount) ? ForgetAllGuests(change) : change;
    }

    /// <summary>
    /// The erasure that reapplies a deletion after a backup is restored (E6.3, question 231): the restored group may still
    /// have the person as its only active admin, a handover the current database had already made. The person goes
    /// anyway, and the oldest active member with an account (the earliest <see cref="GroupMember.JoinedAt"/>, then the
    /// lowest <see cref="GroupMember.Id"/>) becomes Admin, a co-admin included. A guest never does: with no one with an
    /// account left, the group stays without an admin.
    /// </summary>
    public GroupChange EraseAccountAfterRestore(UserId person, DateTimeOffset now)
    {
        var change = EraseAccount(person, now);
        if (!LosesLastAdminWith(person))
        {
            return change;
        }

        var heir = change.Group.ActiveMembers.Where(member => member.HasAccount)
            .OrderBy(member => member.JoinedAt).ThenBy(member => member.Id.Value).FirstOrDefault();
        if (heir is null)
        {
            return change;
        }

        var promoted = heir with { Role = GroupRole.Admin };
        return change with
        {
            Group = change.Group with { Members = change.Group.Members.Replace(heir, promoted) },
            ChangedMembers = change.ChangedMembers.Add(promoted),
        };
    }

    /// <summary>The person is the only active admin here, so the group has none once the account goes.</summary>
    public bool LosesLastAdminWith(UserId person) =>
        ActiveMemberOf(person) is { IsActiveAdmin: true } admin
        && !ActiveMembers.Any(member => member.IsActiveAdmin && member.Id != admin.Id);

    private static GroupChange ForgetAllGuests(GroupChange change) => change.Group.Guests.IsEmpty ? change : change with
    {
        Group = change.Group with { Guests = [] },
        RemovedGuests = [.. change.Group.Guests.Select(guest => guest.MemberId)],
    };
}
