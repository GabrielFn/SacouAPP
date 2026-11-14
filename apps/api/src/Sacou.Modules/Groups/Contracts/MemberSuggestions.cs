using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Levels;

namespace Sacou.Modules.Groups.Contracts;

/// <summary>The suggested level of each person, read from Identity in one call, as a <see cref="SkillLevel"/>.</summary>
internal static class MemberSuggestions
{
    public static async Task<IReadOnlyDictionary<Guid, SkillLevel>> FindAsync(
        IPlayerProfiles profiles, IEnumerable<UserId?> users, CancellationToken cancellationToken)
    {
        Guid[] ids = [.. users.OfType<UserId>().Select(user => user.Value).Distinct()];
        var found = await profiles.FindManyAsync(ids, cancellationToken).ConfigureAwait(false);
        return found
            .Where(profile => profile.SuggestedLevelTenths is not null)
            .Select(profile => (profile.UserId, Level: SkillLevel.FromTenths(profile.SuggestedLevelTenths!.Value)))
            .Where(pair => pair.Level.IsSuccess)
            .ToDictionary(pair => pair.UserId, pair => pair.Level.Value);
    }

    public static SkillLevel? Of(IReadOnlyDictionary<Guid, SkillLevel> suggestions, UserId? user) =>
        user is { } person && suggestions.TryGetValue(person.Value, out var level) ? level : null;
}
