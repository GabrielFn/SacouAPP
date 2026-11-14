using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Identity.Domain.Profiles;

namespace Sacou.Modules.Identity.Infrastructure;

/// <summary><see cref="IPlayerProfiles"/> over the store: one query for the whole list, never one per user.</summary>
internal sealed class StorePlayerProfiles(IPlayerProfileStore store) : IPlayerProfiles
{
    public async Task<IReadOnlyList<PlayerProfileView>> FindManyAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken)
    {
        var profiles = await store.FindManyAsync(userIds, cancellationToken).ConfigureAwait(false);
        return [.. profiles.Select(ToView)];
    }

    private static PlayerProfileView ToView(PlayerProfile profile) => new(
        profile.UserId.Value,
        profile.Nickname.Value,
        profile.Positions.Primary is { } primary ? ProfileContractValues.ToContract(primary) : null,
        [.. profile.Positions.Others.Select(ProfileContractValues.ToContract)],
        profile.SuggestedLevel?.Tenths);
}
