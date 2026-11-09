using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Infrastructure;

namespace Sacou.Modules.Groups.Contracts;

internal sealed class StoreGroupMembership(IGroupStore store) : IGroupMembership
{
    public async Task<GroupMembership?> FindActiveAsync(Guid groupId, Guid userId, CancellationToken cancellationToken)
    {
        var member = await store.FindActiveMemberAsync(new GroupId(groupId), new UserId(userId), cancellationToken).ConfigureAwait(false);
        return member is null
            ? null
            : new GroupMembership(member.Id.Value, ContractValues.ToContract(member.Role), ContractValues.ToContract(member.Type));
    }
}
