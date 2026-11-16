using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Identity.Contracts;
using DomainUserId = Sacou.Modules.Groups.Domain.Members.UserId;

namespace Sacou.Modules.Groups.AccountData;

/// <summary>
/// The groups where the person is the last admin and someone could take over (<see cref="DeletionRules"/>). A
/// preview without a lock: the delete of part 2 decides again under the group locks (ADR 0056, D7 and D10). The name
/// goes along because the person, an active admin there, already sees it.
/// </summary>
internal sealed class GroupsDeletionBlockers(IGroupStore store) : IAccountDeletionBlockers
{
    public async Task<IReadOnlyList<DeletionBlocker>> FindAsync(Guid userId, CancellationToken cancellationToken)
    {
        var person = new DomainUserId(userId);
        var groups = await store.ListGroupsWhereActiveAdminAsync(person, cancellationToken).ConfigureAwait(false);
        return [.. groups
            .Where(group => group.ActiveMemberOf(person) is { } member && DeletionRules.IsDeletionBlocker(group, member.Id))
            .Select(group => new DeletionBlocker(group.Id.Value, group.Name.Value, DeletionBlockerKind.LastAdmin))];
    }
}
