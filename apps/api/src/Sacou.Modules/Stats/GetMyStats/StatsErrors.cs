using Sacou.Shared.Results;

namespace Sacou.Modules.Stats.GetMyStats;

/// <summary>The refusals of the stats routes, by code only; the pt-BR texts are the app's.</summary>
internal static class StatsErrors
{
    /// <summary>The <c>year</c> of <c>/v1/me/stats</c> is not a whole number from <see cref="Seasons.First"/> to <see cref="Seasons.Last"/>.</summary>
    public static readonly Error YearInvalid = new("stats.year-invalid", ErrorKind.Validation);
}
