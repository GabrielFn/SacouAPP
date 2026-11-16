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

    private static GroupChange ForgetAllGuests(GroupChange change) => change.Group.Guests.IsEmpty ? change : change with
    {
        Group = change.Group with { Guests = [] },
        RemovedGuests = [.. change.Group.Guests.Select(guest => guest.MemberId)],
    };
}
