namespace Sacou.Modules.Groups.Contracts;

/// <summary>
/// The level of each member for the draw (E3.6) and the rating seed (E3.9), server side only (ADR 0051, D9): the
/// admin's, else the player's suggestion, else 3,0, with where it came from. No HTTP route exposes this contract.
/// </summary>
public interface IMemberLevels
{
    /// <summary>
    /// One entry per id that is a member of the group (any status), in the order they joined. An id of another
    /// group, or of no member, is absent; a group that does not exist gives an empty list.
    /// </summary>
    Task<IReadOnlyList<ResolvedLevel>> ResolveAsync(Guid groupId, IReadOnlyCollection<Guid> memberIds, CancellationToken cancellationToken);
}

/// <summary>The level in whole tenths (10 to 50, of 5 in 5), as <c>Sacou.Shared.Levels.SkillLevel</c> keeps it.</summary>
public sealed record ResolvedLevel(Guid MemberId, int LevelTenths, LevelSource Source);

/// <summary>Mirrors the domain origin, converted by hand: the domain enum stays internal.</summary>
public enum LevelSource
{
    Admin,
    Suggested,
    Default,
}
