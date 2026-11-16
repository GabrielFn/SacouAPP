using Sacou.Modules.Groups.Contracts;

namespace Sacou.Integration.Tests;

/// <summary>A pass-through <see cref="IGroupMembership"/> that lets a test act just before the n-th lookup of one request.</summary>
internal sealed class HookedMembership(IGroupMembership inner, Func<Func<int, Task>?> hook) : IGroupMembership
{
    private int lookups;

    public async Task<GroupMembership?> FindActiveAsync(Guid groupId, Guid userId, CancellationToken cancellationToken)
    {
        lookups++;
        if (hook() is { } before)
        {
            await before(lookups).ConfigureAwait(false);
        }

        return await inner.FindActiveAsync(groupId, userId, cancellationToken).ConfigureAwait(false);
    }

    public Task<IReadOnlyList<GroupMembership>> ListActiveAsync(Guid groupId, CancellationToken cancellationToken) =>
        inner.ListActiveAsync(groupId, cancellationToken);

    public Task<IReadOnlyList<Guid>> ListMemberIdsOfUserAsync(Guid userId, CancellationToken cancellationToken) =>
        inner.ListMemberIdsOfUserAsync(userId, cancellationToken);

    public bool Allows(GroupRole role, GroupCapability capability) => inner.Allows(role, capability);
}
