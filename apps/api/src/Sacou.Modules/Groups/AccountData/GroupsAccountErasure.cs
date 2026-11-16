using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Identity.Contracts;
using DomainUserId = Sacou.Modules.Groups.Domain.Members.UserId;

namespace Sacou.Modules.Groups.AccountData;

/// <summary>
/// The account deletion in the Groups (E3.16, ADR 0056, D1, D2 and D7): under the locks of every group of the person,
/// the deletion rule is judged again (<see cref="DeletionRules"/>; the preview of screen 30b may be stale), and then
/// the person becomes a former player in each group, the invites they made die and the levels about them go.
/// </summary>
internal sealed class GroupsAccountErasure(IGroupStore store, TimeProvider time) : IAccountErasure
{
    public async Task<IReadOnlyList<Guid>> EraseAsync(Guid userId, ErasureMode mode, CancellationToken cancellationToken)
    {
        var person = new DomainUserId(userId);
        var now = time.GetUtcNow();
        var blocking = await store.EraseAccountAsync(
            person,
            group => mode == ErasureMode.Checked && group.ActiveMemberOf(person) is { } member && DeletionRules.IsDeletionBlocker(group, member.Id),
            group => group.EraseAccount(person, now),
            cancellationToken).ConfigureAwait(false);
        return [.. blocking.Select(group => group.Value)];
    }
}
