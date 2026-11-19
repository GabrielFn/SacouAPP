using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Infrastructure;

namespace Sacou.Modules.Groups.Contracts;

internal sealed class StoreGroupDirectory(IGroupStore store) : IGroupDirectory
{
    public async Task<string?> FindNameAsync(Guid groupId, CancellationToken cancellationToken)
    {
        var overview = await store.FindOverviewAsync(new GroupId(groupId), cancellationToken).ConfigureAwait(false);
        return overview?.Name.Value;
    }
}
