using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Identity.Contracts;
using DomainMemberType = Sacou.Modules.Groups.Domain.Members.MemberType;

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
        var byUser = await RosterProfiles.FindAsync(profiles, roster, cancellationToken).ConfigureAwait(false);
        return roster.ToDictionary(entry => entry.Member.Id.Value, entry => NameOf(entry, byUser));
    }

    private static ListName NameOf(RosterEntry entry, Dictionary<Guid, PlayerProfileView> byUser)
    {
        var nickname = entry is { Member.UserId: null, Guest: { } guest }
            ? FirstName(guest.Name.Value)
            : entry.Member.UserId is { } user ? byUser.GetValueOrDefault(user.Value)?.Nickname : null;
        return new ListName(nickname, entry.Member.Type == DomainMemberType.Regular);
    }

    /// <summary>
    /// A guest is someone without an account, named by the admin, and the page is open to anyone holding the link: only
    /// the first word of the name, trimmed (question 126, "first names for everyone"; ADR 0070, D5). Null when blank.
    /// </summary>
    internal static string? FirstName(string name)
    {
        var words = name.Split((char[]?)null, 2, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return words.Length == 0 ? null : words[0];
    }
}
