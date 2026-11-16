using Sacou.Modules.Sessions.Domain.Draw;
using Xunit;

namespace Sacou.Modules.Sessions.Tests.Draw;

/// <summary>The ceiling of placement steps is per draw (ADR 0055): the factory must hand out exactly that many.</summary>
public sealed class PlacementBudgetTests
{
    [Fact]
    public void ABudgetForADraw_HoldsExactlyTheCeilingOfSteps()
    {
        var budget = PlacementBudget.ForADraw();

        Assert.Equal(DrawLimits.MaxPlacementSteps, budget.Remaining);
        for (var step = 0; step < DrawLimits.MaxPlacementSteps; step++)
        {
            Assert.True(budget.TrySpend());
        }

        Assert.True(budget.IsSpent);
        Assert.False(budget.TrySpend());
        Assert.Equal(0, budget.Remaining);
    }
}
