using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.Infrastructure;

namespace Sacou.Modules.Groups.Contracts;

internal sealed class StoreGroupMembership(IGroupStore store) : IGroupMembership
{
    public async Task<GroupMembership?> FindActiveAsync(Guid groupId, Guid userId, CancellationToken cancellationToken)
    {
        var member = await store.FindActiveMemberAsync(new GroupId(groupId), new UserId(userId), cancellationToken).ConfigureAwait(false);
        return member is null ? null : ToContract(member);
    }

    public async Task<IReadOnlyList<GroupMembership>> ListActiveAsync(Guid groupId, CancellationToken cancellationToken)
    {
        var members = await store.ListActiveMembersAsync(new GroupId(groupId), cancellationToken).ConfigureAwait(false);
        return [.. members.Select(ToContract)];
    }

    public async Task<IReadOnlyList<Guid>> ListMemberIdsOfUserAsync(Guid userId, CancellationToken cancellationToken)
    {
        var memberships = await store.ListMembershipsOfUserAsync(new UserId(userId), cancellationToken).ConfigureAwait(false);
        return [.. memberships.Select(membership => membership.Member.Id.Value)];
    }

    public bool Allows(GroupRole role, GroupCapability capability) =>
        RolePermissions.Allows(ContractValues.ToDomain(role), ContractValues.ToDomain(capability));

    private static GroupMembership ToContract(GroupMember member) =>
        new(member.Id.Value, ContractValues.ToContract(member.Role), ContractValues.ToContract(member.Type));
}
