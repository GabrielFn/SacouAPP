using Sacou.Modules.Stats.GetMyStats;
using Xunit;

namespace Sacou.Modules.Stats.Tests.GetMyStats;

/// <summary>L4 of E3.9: the <c>year</c> of the profile, valid or refused as <c>stats.year-invalid</c>.</summary>
public sealed class SeasonsTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 20, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void NoYear_IsTheCurrentSeason() => Assert.Equal(2026, Seasons.Parse(null, Now));

    [Fact]
    public void NewYearsEve_InSaoPaulo_IsStillTheOldSeason() =>
        Assert.Equal(2025, Seasons.Parse(null, new DateTimeOffset(2026, 1, 1, 1, 0, 0, TimeSpan.Zero)));

    [Theory]
    [InlineData("2000", 2000)]
    [InlineData("2026", 2026)]
    [InlineData("2100", 2100)]
    public void ABoundaryYear_IsAccepted(string year, int expected) => Assert.Equal(expected, Seasons.Parse(year, Now));

    [Theory]
    [InlineData("")]
    [InlineData("1999")]
    [InlineData("2101")]
    [InlineData("-2026")]
    [InlineData("+2026")]
    [InlineData(" 2026")]
    [InlineData("2026 ")]
    [InlineData("20.26")]
    [InlineData("abc")]
    [InlineData("99999999999999999999")]
    public void AnInvalidYear_IsNull(string year) => Assert.Null(Seasons.Parse(year, Now));

    [Fact]
    public void TheRefusal_IsTheYearInvalidCode() => Assert.Equal("stats.year-invalid", StatsErrors.YearInvalid.Code);
}
