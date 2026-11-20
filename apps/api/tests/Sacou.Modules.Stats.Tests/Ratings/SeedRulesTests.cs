using Sacou.Modules.Stats.Domain.Ratings;
using Xunit;

namespace Sacou.Modules.Stats.Tests.Ratings;

/// <summary>Port of <c>seed.test.ts</c> (rules 22 and 23).</summary>
public sealed class SeedRulesTests
{
    private static readonly RatingParams Parameters = RatingGolden.Parameters;

    public static TheoryData<int> HalfLevels => new(Enumerable.Range(0, 9).Select(step => SeedRules.MinLevelTenths + (step * 5)));

    [Theory]
    [MemberData(nameof(HalfLevels))]
    public void SeedThenLevel_IsExact_OnEveryHalfLevel(int levelTenths)
    {
        var seed = SeedRules.SeedOf(Parameters, levelTenths, SeedSource.Suggested);

        Assert.Equal(levelTenths, SeedRules.LevelOf(Parameters, seed.Mu));
    }

    [Theory]
    [InlineData(10, 1100)]
    [InlineData(30, 1500)]
    [InlineData(45, 1800)]
    [InlineData(50, 1900)]
    public void Mu_OfALevel_FollowsAdr0018(int levelTenths, double mu)
    {
        Assert.Equal(mu, SeedRules.MuOfLevel(Parameters, levelTenths));
    }

    [Theory]
    [InlineData(-100_000, 10)]
    [InlineData(100_000, 50)]
    [InlineData(1510, 31)]
    [InlineData(1509.99, 30)]
    public void Level_IsRoundedHalfUp_AndLimited(double mu, int levelTenths)
    {
        Assert.Equal(levelTenths, SeedRules.LevelOf(Parameters, mu));
    }

    [Fact]
    public void AdminSeed_HasTheLowSigma_AndTheOthersTheHighOne()
    {
        Assert.Equal(Parameters.SigmaAdmin, SeedRules.SeedOf(Parameters, 30, SeedSource.Admin).Sigma);
        Assert.Equal(Parameters.SigmaUnconfirmed, SeedRules.SeedOf(Parameters, 30, SeedSource.Suggested).Sigma);
        Assert.Equal(Parameters.SigmaUnconfirmed, SeedRules.SeedOf(Parameters, 30, SeedSource.Default).Sigma);
    }
}
