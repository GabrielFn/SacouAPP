namespace Sacou.Modules.Sessions.Domain.Draw;

/// <summary>
/// The steps of placement one draw may spend, shared by every start of the search (ADR 0055): the ceiling holds for
/// the whole request, not for each placement, so no body makes a draw run for long.
/// </summary>
internal sealed class PlacementBudget
{
    public PlacementBudget(int steps)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(steps);
        Remaining = steps;
    }

    public int Remaining { get; private set; }

    public bool IsSpent => Remaining == 0;

    /// <summary>The budget of one draw, <see cref="DrawLimits.MaxPlacementSteps"/>.</summary>
    public static PlacementBudget ForADraw() => new(DrawLimits.MaxPlacementSteps);

    /// <summary>False, spending nothing, once the budget is gone.</summary>
    public bool TrySpend()
    {
        if (IsSpent)
        {
            return false;
        }

        Remaining--;
        return true;
    }
}
