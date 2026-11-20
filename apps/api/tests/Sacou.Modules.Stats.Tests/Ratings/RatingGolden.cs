using System.Collections.Immutable;
using System.Text.Json;
using Sacou.Modules.Stats.Domain.Ratings;
using Sacou.Modules.Stats.RatingParameters;
using Xunit;

namespace Sacou.Modules.Stats.Tests.Ratings;

/// <summary>Reading and comparing the two golden files of the rating (ADR 0071).</summary>
internal static class RatingGolden
{
    /// <summary>
    /// <c>|Δ| ≤ 1e-9 × max(1, |expected|)</c>: <c>Math.Exp</c> of .NET and of V8 may differ by one ULP
    /// (risk 3 of the plan); everything else is exact.
    /// </summary>
    private const double RelativeTolerance = 1e-9;

    public static readonly RatingParams Parameters = EmbeddedRatingParams.Load();

    public static void AssertClose(double expected, double actual, string context)
    {
        Assert.True(double.IsFinite(actual), $"{context}: not finite.");
        Assert.True(
            Math.Abs(actual - expected) <= RelativeTolerance * Math.Max(1, Math.Abs(expected)),
            $"{context}: expected {expected:R}, got {actual:R}.");
    }

    public static Skill SkillOf(JsonElement skill) => new(skill.GetProperty("mu").GetDouble(), skill.GetProperty("sigma").GetDouble());

    public static ImmutableArray<Skill> TeamOf(JsonElement team) => [.. team.EnumerateArray().Select(SkillOf)];

    public static void AssertTeam(JsonElement expected, ImmutableArray<Skill> actual, string context)
    {
        var skills = TeamOf(expected);
        Assert.Equal(skills.Length, actual.Length);
        for (var index = 0; index < skills.Length; index++)
        {
            AssertClose(skills[index].Mu, actual[index].Mu, $"{context}[{index}].mu");
            AssertClose(skills[index].Sigma, actual[index].Sigma, $"{context}[{index}].sigma");
        }
    }
}
