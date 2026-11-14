using Sacou.Shared.Levels;
using Xunit;

namespace Sacou.Shared.Tests;

/// <summary>P1 of E3.17 (ADR 0051, D4): 1 to 5 in half points, as whole tenths, never rounded.</summary>
public sealed class SkillLevelTests
{
    public static readonly TheoryData<decimal, int> OnTheScale = new()
    {
        { 1m, 10 },
        { 1.5m, 15 },
        { 3m, 30 },
        { 4.5m, 45 },
        { 4.50m, 45 },
        { 5m, 50 },
    };

    public static readonly TheoryData<decimal> OffTheScale = new()
    {
        0.5m,
        5.5m,
        4.25m,
        4.05m,
        0m,
        -1m,
        -4.5m,
        decimal.MaxValue,
        decimal.MinValue,
    };

    [Theory]
    [MemberData(nameof(OnTheScale))]
    public void ValuesOnTheScale_AreAcceptedAsTenths(decimal value, int tenths)
    {
        var level = SkillLevel.FromDecimal(value);

        Assert.True(level.IsSuccess);
        Assert.Equal(tenths, level.Value.Tenths);
    }

    [Theory]
    [MemberData(nameof(OffTheScale))]
    public void ValuesOffTheScale_AreRefused(decimal value)
    {
        Assert.Equal(SkillLevel.OutOfScale, SkillLevel.FromDecimal(value).Error);
    }

    [Theory]
    [InlineData(10)]
    [InlineData(15)]
    [InlineData(30)]
    [InlineData(45)]
    [InlineData(50)]
    public void Tenths_GoThereAndBack(int tenths)
    {
        var level = SkillLevel.FromTenths(tenths).Value;

        Assert.Equal(tenths, SkillLevel.FromDecimal(level.ToDecimal()).Value.Tenths);
        Assert.Equal(tenths / 10m, level.ToDecimal());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(5)]
    [InlineData(9)]
    [InlineData(11)]
    [InlineData(42)]
    [InlineData(55)]
    [InlineData(-10)]
    public void TenthsOffTheScale_AreRefused(int tenths)
    {
        Assert.True(SkillLevel.FromTenths(tenths).IsFailure);
    }

    [Fact]
    public void Default_IsThree()
    {
        Assert.Equal(30, SkillLevel.Default.Tenths);
        Assert.Equal(3m, SkillLevel.Default.ToDecimal());
    }

    [Fact]
    public void ScaleConstants_AreTheOnesOfTheGlossary()
    {
        Assert.Equal((10, 50, 5, 30), (SkillLevel.MinTenths, SkillLevel.MaxTenths, SkillLevel.StepTenths, SkillLevel.DefaultTenths));
    }
}
