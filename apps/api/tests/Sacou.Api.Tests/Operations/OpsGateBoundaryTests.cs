using Sacou.Api.Operations;
using Sacou.Modules.Sessions.Contracts;
using Xunit;

namespace Sacou.Api.Tests.Operations;

/// <summary>Criteria 19 and 21 of E7.2: the gate is exactly 60%, never rounded up to it.</summary>
public sealed class OpsGateBoundaryTests
{
    private static readonly DateOnly Monday = new(2026, 10, 5);

    [Theory]
    [InlineData(596, 1000, false)]
    [InlineData(599, 1000, false)]
    [InlineData(600, 1000, true)]
    [InlineData(3, 5, true)]
    [InlineData(59, 100, false)]
    public void Reaches_target_only_from_exactly_sixty_percent(int self, int confirmed, bool expected)
    {
        var week = OpsGateCalculator.Count([new HeldWeek(Guid.NewGuid(), Monday, 1, confirmed, self, 0)]);

        Assert.Equal(expected, OpsGateCalculator.ReachesTarget(week));
    }

    [Fact]
    public void Week_without_confirmed_never_reaches_the_target()
    {
        var week = OpsGateCalculator.Count([new HeldWeek(Guid.NewGuid(), Monday, 1, 0, 0, 0)]);

        Assert.Null(week.Rate);
        Assert.False(OpsGateCalculator.ReachesTarget(week));
    }
}
