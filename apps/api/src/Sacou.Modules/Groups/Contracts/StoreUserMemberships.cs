using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Infrastructure;

namespace Sacou.Modules.Groups.Contracts;

/// <summary>One read of the memberships, then one read of the settings of each active group (a person is in few groups).</summary>
internal sealed class StoreUserMemberships(IGroupStore store, IGroupSettingsReader settings) : IUserMemberships
{
    public async Task<IReadOnlyList<UserMembership>> ListAsync(Guid userId, CancellationToken cancellationToken)
    {
        var memberships = await store.ListMembershipsOfUserAsync(new UserId(userId), cancellationToken).ConfigureAwait(false);
        var found = new List<UserMembership>(memberships.Count);
        foreach (var membership in memberships)
        {
            var member = membership.Member;
            var modality = member.IsActive ? await ModalityAsync(membership.GroupId.Value, cancellationToken).ConfigureAwait(false) : (GameModality?)null;
            found.Add(new UserMembership(
                membership.GroupId.Value,
                member.IsActive ? membership.GroupName.Value : null,
                member.Id.Value,
                member.IsActive,
                member.JoinedAt,
                member.LeftAt,
                modality));
        }

        return found;
    }

    /// <summary>The group's own modality: its settings with an empty round layer.</summary>
    private async Task<GameModality> ModalityAsync(Guid groupId, CancellationToken cancellationToken)
    {
        var snapshot = await settings.GetAsync(groupId, cancellationToken).ConfigureAwait(false)
            ?? throw new InvalidOperationException("A membership of a group without settings.");
        var resolved = settings.ResolveRound(snapshot, roundLayerJson: null);
        return resolved.IsSuccess ? resolved.Value.Summary.Modality : throw new InvalidOperationException("The group settings do not resolve.");
    }
}
