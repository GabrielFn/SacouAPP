using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Levels;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Members;

namespace Sacou.Modules.Groups.Contracts;

/// <summary><see cref="IMemberLevels"/> over the level store and the profiles of Identity: two queries, never one per member.</summary>
internal sealed class StoreMemberLevels(IMemberLevelStore store, IPlayerProfiles profiles) : IMemberLevels
{
    public async Task<IReadOnlyList<ResolvedLevel>> ResolveAsync(
        Guid groupId, IReadOnlyCollection<Guid> memberIds, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(memberIds);
        var inputs = await store.FindInputsAsync(new GroupId(groupId), [.. memberIds.Select(id => new MemberId(id))], cancellationToken)
            .ConfigureAwait(false);
        var suggestions = await MemberSuggestions.FindAsync(profiles, inputs.Select(input => input.UserId), cancellationToken).ConfigureAwait(false);
        return [.. inputs.Select(input =>
        {
            var resolved = MemberLevelResolver.Resolve(input.Level?.Level, MemberSuggestions.Of(suggestions, input.UserId));
            return new ResolvedLevel(input.MemberId.Value, resolved.Level.Tenths, ToContract(resolved.Origin));
        })];
    }

    private static LevelSource ToContract(LevelOrigin origin) => origin switch
    {
        LevelOrigin.Admin => LevelSource.Admin,
        LevelOrigin.Suggested => LevelSource.Suggested,
        LevelOrigin.Default => LevelSource.Default,
        _ => throw new ArgumentOutOfRangeException(nameof(origin), origin, "Every origin needs a public twin."),
    };
}
