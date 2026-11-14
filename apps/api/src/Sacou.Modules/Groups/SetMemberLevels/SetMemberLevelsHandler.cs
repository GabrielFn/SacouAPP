using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Levels;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Shared.Levels;
using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.SetMemberLevels;

/// <summary>One item as it came on the wire: the member and the number, null for "Não sei".</summary>
internal sealed record RequestedLevel(Guid MemberId, decimal? Level);

/// <summary>
/// Both level writes, the batch and the single one (a batch of one): the values are read on the scale first,
/// a value off the scale is the module's own code, never <c>level.out-of-scale</c>; then the rule runs under the group lock (ADR 0051, D10). All of them are written, or none.
/// </summary>
internal sealed class SetMemberLevelsHandler(IMemberLevelStore store, TimeProvider time)
{
    public async Task<Result<MemberLevelChange>> HandleAsync(
        GroupId group, MemberId actor, IReadOnlyList<RequestedLevel> requested, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(requested);
        if (requested.Any(item => item.Level is { } number && SkillLevel.FromDecimal(number).IsFailure))
        {
            return Result.Failure<MemberLevelChange>(GroupErrors.LevelInvalid);
        }

        LevelAssignment[] assignments = [.. requested.Select(item => new LevelAssignment(new MemberId(item.MemberId), ToLevel(item.Level)))];
        var now = time.GetUtcNow();
        return await store.ExecuteInGroupLockAsync(group, context => MemberLevels.Set(context, actor, assignments, now), cancellationToken)
            .ConfigureAwait(false);
    }

    /// <summary>Null is "Não sei". Only called after every value was checked on the scale.</summary>
    private static SkillLevel? ToLevel(decimal? value) => value is { } number ? SkillLevel.FromDecimal(number).Value : null;
}
