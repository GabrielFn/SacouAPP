using System.Collections.Immutable;
using Sacou.Shared.Members;

namespace Sacou.Modules.Stats.Domain.Ratings;

/// <summary>Where the level of a member comes from, as <c>IMemberLevels</c> resolves it (E1.3). The codes are the TypeScript ones.</summary>
internal sealed record SeedSource
{
    public static readonly SeedSource Admin = new("admin");
    public static readonly SeedSource Suggested = new("suggested");
    public static readonly SeedSource Default = new("default");

    public static readonly ImmutableArray<SeedSource> All = [Admin, Suggested, Default];

    private SeedSource(string code) => Code = code;

    public string Code { get; }

    public static SeedSource? FromCode(string code) =>
        All.FirstOrDefault(source => string.Equals(source.Code, code, StringComparison.Ordinal));
}

/// <summary>The seed of a member: the current resolved level, in tenths (question 98, option 1).</summary>
internal sealed record RatingSeed(MemberId MemberId, int LevelTenths, SeedSource Source);

/// <summary>Port of <c>packages/rating/src/seed.ts</c>: level and μ both ways (ADR 0018 and 0071, rules 22 and 23).</summary>
internal static class SeedRules
{
    /// <summary>Levels go in tenths: 30 is 3.0, the level of a member nobody rated.</summary>
    public const int TenthsPerLevel = 10;
    public const int BaseLevelTenths = 30;
    public const int MinLevelTenths = 10;
    public const int MaxLevelTenths = 50;

    private const double Half = 0.5;

    /// <summary>μ of a level: <c>mu0 + (level − 3.0) × levelStep</c>, in the operation order of TypeScript.</summary>
    public static double MuOfLevel(RatingParams parameters, int levelTenths) =>
        parameters.Mu0 + ((double)(levelTenths - BaseLevelTenths) * parameters.LevelStep / TenthsPerLevel);

    /// <summary>
    /// The starting skill of a member. The admin grade is trusted, so its σ is low; a suggestion or the
    /// default 3.0 starts with a high σ and moves more.
    /// </summary>
    public static Skill SeedOf(RatingParams parameters, int levelTenths, SeedSource source) =>
        new(MuOfLevel(parameters, levelTenths), source == SeedSource.Admin ? parameters.SigmaAdmin : parameters.SigmaUnconfirmed);

    /// <summary>The level a μ stands for, in tenths, rounded half up and limited to 1.0 to 5.0. After the pilot only.</summary>
    public static int LevelOf(RatingParams parameters, double mu)
    {
        var tenths = BaseLevelTenths + ((mu - parameters.Mu0) * TenthsPerLevel / parameters.LevelStep);
        var rounded = Math.Floor(tenths + Half);
        return (int)Math.Clamp(rounded, MinLevelTenths, MaxLevelTenths);
    }

    public static bool IsValidLevelTenths(int levelTenths) => levelTenths is >= MinLevelTenths and <= MaxLevelTenths;
}
