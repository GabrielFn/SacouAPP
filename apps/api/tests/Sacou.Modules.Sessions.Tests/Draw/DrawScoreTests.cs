using Sacou.Modules.Sessions.Domain.Draw;
using Xunit;

namespace Sacou.Modules.Sessions.Tests.Draw;

/// <summary>G7: averages compare by cross product, so teams of different sizes never go through a fraction.</summary>
public sealed class DrawScoreTests
{
    [Fact]
    public void Of_SameSizes_ComparesTheSums()
    {
        var closer = DrawScore.Of([220, 225], [6, 6]);
        var farther = DrawScore.Of([215, 230], [6, 6]);

        Assert.True(closer.IsBetterThan(farther));
    }

    [Fact]
    public void Of_DifferentSizes_ComparesTheExactAverages()
    {
        // 150/5 = 30 and 186/6 = 31: gap 1. 120/4 = 30 and 155/5 = 31: the same gap, on other sizes.
        var five = DrawScore.Of([150, 186], [5, 6]);
        var four = DrawScore.Of([120, 155], [4, 5]);
        // 100/3 = 33,33 and 135/4 = 33,75: gap 0,42, smaller, though the sums differ by 35.
        var three = DrawScore.Of([100, 135], [3, 4]);

        Assert.True(five.SameGapAs(four));
        Assert.True(three.IsBetterThan(five));
        Assert.Equal((5L * 186) - (6L * 150), five.GapNumerator);
        Assert.Equal(30L, five.GapDenominator);
    }

    [Fact]
    public void Of_EqualGaps_PrefersTheLowerSpreadOfSums()
    {
        // Same total (420) and the same gap (10): the sums closer to their mean win.
        var even = DrawScore.Of([100, 105, 105, 110], [3, 3, 3, 3]);
        var uneven = DrawScore.Of([100, 100, 110, 110], [3, 3, 3, 3]);

        Assert.True(even.SameGapAs(uneven));
        Assert.True(even.IsBetterThan(uneven));
    }
}
