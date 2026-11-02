using System.Text.Json;
using Sacou.Modules.Stats.Domain.PlayerCards;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Stats.Tests.PlayerCards;

public sealed class PlayerCardLevelTests
{
    private const int GoldenCaseCount = 18;

    private static readonly string[] GoldenIds =
    [
        "floor-1000",
        "floor-1100",
        "ceiling-1900",
        "ceiling-2500",
        "level-2.4-1380",
        "level-2.4-1389.75",
        "level-2.5-1390",
        "level-2.5-1400",
        "level-3.4-1580",
        "level-3.4-1589.75",
        "level-3.5-1590",
        "level-3.5-1600",
        "level-4.4-1780",
        "level-4.4-1789.75",
        "level-4.5-1790",
        "level-4.5-1800",
        "anchor-1500",
        "card-screen-1660",
    ];

    private static readonly HashSet<string> CaseFields = ["id", "rating", "expected"];
    private static readonly HashSet<string> ExpectedFields = ["levelTenths", "tier"];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("player-card-level.json");

    public static TheoryData<string> CaseIds => new(GoldenIds);

    [Fact]
    public void GoldenList_HasTheExactTotal()
    {
        Assert.Equal(GoldenCaseCount, GoldenIds.Length);
    }

    [Fact]
    public void GoldenList_MatchesTheFile()
    {
        GoldenFile.AssertListMatchesFile(GoldenIds, [.. Cases.Select(GoldenFile.IdOf)]);
    }

    [Theory]
    [MemberData(nameof(CaseIds))]
    public void FromRating_MatchesTheGoldenCase(string id)
    {
        var goldenCase = GoldenFile.SingleCase(Cases, GoldenFile.IdOf, id);
        GoldenFile.AssertOnlyFields(goldenCase, CaseFields, id);
        var expected = goldenCase.GetProperty("expected");
        GoldenFile.AssertOnlyFields(expected, ExpectedFields, id);

        var level = PlayerCardLevelCalculator.FromRating(GoldenFile.Number(goldenCase.GetProperty("rating"), id)).Value;

        GoldenFile.AssertExact(GoldenFile.Number(expected.GetProperty("levelTenths"), id), level.LevelTenths, id);
        Assert.Equal(GoldenFile.Text(expected, "tier"), level.Tier.Code);
    }

    [Theory]
    [InlineData(double.NaN)]
    [InlineData(double.PositiveInfinity)]
    [InlineData(double.NegativeInfinity)]
    public void FromRating_WithoutAFiniteRating_FailsAsInvalidRating(double rating)
    {
        var result = PlayerCardLevelCalculator.FromRating(rating);

        Assert.True(result.IsFailure);
        Assert.Equal("invalid-rating", result.Error.Code);
    }

    [Fact]
    public void FromRating_AtTheLargestRating_IsTheTopLevel()
    {
        var level = PlayerCardLevelCalculator.FromRating(double.MaxValue).Value;

        Assert.Equal(50, level.LevelTenths);
        Assert.Equal("elite", level.Tier.Code);
    }

    [Fact]
    public void FromRating_AtTheSmallestRating_IsTheBottomLevel()
    {
        var level = PlayerCardLevelCalculator.FromRating(-double.MaxValue).Value;

        Assert.Equal(10, level.LevelTenths);
        Assert.Equal("bronze", level.Tier.Code);
    }

    [Fact]
    public void Tiers_HaveTheCodesOfTheOtherLanguage()
    {
        Assert.Equal(["bronze", "silver", "gold", "elite"], PlayerCardTier.All.Select(tier => tier.Code));
    }
}
