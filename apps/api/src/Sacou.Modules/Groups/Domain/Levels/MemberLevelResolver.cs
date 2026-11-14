using Sacou.Shared.Levels;

namespace Sacou.Modules.Groups.Domain.Levels;

/// <summary>Where a resolved level came from, for the uncertainty of the rating (E3.9).</summary>
internal enum LevelOrigin
{
    Admin,
    Suggested,
    Default,
}

internal sealed record ResolvedSkill(SkillLevel Level, LevelOrigin Origin);

/// <summary>
/// The level the draw uses (ADR 0051, D9): the admin's, else the player's suggestion, else 3,0. "Não sei" (a
/// reviewed row without a level) and a member never reviewed both fall to the suggestion. Pure: no clock, no I/O.
/// </summary>
internal static class MemberLevelResolver
{
    public static ResolvedSkill Resolve(SkillLevel? adminLevel, SkillLevel? suggestion)
    {
        if (adminLevel is not null)
        {
            return new ResolvedSkill(adminLevel, LevelOrigin.Admin);
        }

        return suggestion is not null
            ? new ResolvedSkill(suggestion, LevelOrigin.Suggested)
            : new ResolvedSkill(SkillLevel.Default, LevelOrigin.Default);
    }
}
