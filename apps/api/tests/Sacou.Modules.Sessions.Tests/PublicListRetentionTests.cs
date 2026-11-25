using Sacou.Modules.Sessions.Domain.Rounds;
using Xunit;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>E6.7, criteria 1, 2 and 7: the public list leaves the page 7 days after the start instant, the instant included.</summary>
public sealed class PublicListRetentionTests
{
    private static readonly DateTimeOffset StartsAt = new(2026, 11, 5, 22, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Period_IsSevenDays() => Assert.Equal(TimeSpan.FromDays(7), PublicListRetention.Period);

    [Fact]
    public void SixDaysAfter_IsNotExpired() => Assert.False(PublicListRetention.IsExpired(StartsAt, StartsAt.AddDays(6)));

    [Fact]
    public void OneSecondBeforeSevenDays_IsNotExpired() =>
        Assert.False(PublicListRetention.IsExpired(StartsAt, StartsAt.AddDays(7).AddSeconds(-1)));

    [Fact]
    public void ExactlySevenDays_IsExpired() => Assert.True(PublicListRetention.IsExpired(StartsAt, StartsAt.AddDays(7)));

    [Fact]
    public void EightDaysAfter_IsExpired() => Assert.True(PublicListRetention.IsExpired(StartsAt, StartsAt.AddDays(8)));

    /// <summary>19h in São Paulo is 22h UTC: the cut is the instant, whatever offset the clock reads it in.</summary>
    [Fact]
    public void Cut_IsTheInstant_NotTheLocalDay()
    {
        var saoPaulo = TimeSpan.FromHours(-3);
        var localStart = StartsAt.ToOffset(saoPaulo);

        Assert.True(PublicListRetention.IsExpired(localStart, StartsAt.AddDays(7)));
        Assert.False(PublicListRetention.IsExpired(localStart, new DateTimeOffset(2026, 11, 12, 18, 59, 59, saoPaulo)));
        Assert.True(PublicListRetention.IsExpired(StartsAt, new DateTimeOffset(2026, 11, 12, 19, 0, 0, saoPaulo)));
    }
}
