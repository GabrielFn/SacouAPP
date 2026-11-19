using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Identity.Contracts;
using DomainMemberType = Sacou.Modules.Groups.Domain.Members.MemberType;
using UserId = Sacou.Modules.Groups.Domain.Members.UserId;

namespace Sacou.Modules.Groups.Contracts;

/// <summary>The active roster in one query and the profiles in another, like the member list (ADR 0051, D5).</summary>
internal sealed class StoreRoundListNames(IGroupStore store, IPlayerProfiles profiles) : IRoundListNames
{
    public async Task<IReadOnlyDictionary<Guid, ListName>> FindAsync(
        Guid groupId, IReadOnlyCollection<Guid> memberIds, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(memberIds);
        if (memberIds.Count == 0)
        {
            return new Dictionary<Guid, ListName>();
        }

        var wanted = memberIds.ToHashSet();
        var roster = (await store.ListActiveRosterAsync(new GroupId(groupId), cancellationToken).ConfigureAwait(false))
            .Where(entry => wanted.Contains(entry.Member.Id.Value))
            .ToList();
        Guid[] users = [.. roster.Select(entry => entry.Member.UserId).OfType<UserId>().Select(user => user.Value)];
        var byUser = (await profiles.FindManyAsync(users, cancellationToken).ConfigureAwait(false))
            .ToDictionary(profile => profile.UserId, profile => profile.Nickname);
        return roster.ToDictionary(entry => entry.Member.Id.Value, entry => NameOf(entry, byUser));
    }

    private static ListName NameOf(RosterEntry entry, Dictionary<Guid, string> byUser)
    {
        var nickname = entry is { Member.UserId: null, Guest: { } guest }
            ? guest.Name.Value
            : entry.Member.UserId is { } user ? byUser.GetValueOrDefault(user.Value) : null;
        return new ListName(nickname, entry.Member.Type == DomainMemberType.Regular);
    }
}
