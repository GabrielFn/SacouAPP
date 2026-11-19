using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Identity.Contracts;
using UserId = Sacou.Modules.Groups.Domain.Members.UserId;

namespace Sacou.Modules.Groups.Contracts;

/// <summary>The profiles of the members of a roster who have an account, read from Identity in one call (ADR 0051, D5).</summary>
internal static class RosterProfiles
{
    public static async Task<Dictionary<Guid, PlayerProfileView>> FindAsync(
        IPlayerProfiles profiles, IEnumerable<RosterEntry> roster, CancellationToken cancellationToken)
    {
        Guid[] users = [.. roster.Select(entry => entry.Member.UserId).OfType<UserId>().Select(user => user.Value)];
        var found = await profiles.FindManyAsync(users, cancellationToken).ConfigureAwait(false);
        return found.ToDictionary(profile => profile.UserId);
    }
}
