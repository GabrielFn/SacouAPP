using Microsoft.Extensions.Options;

namespace Sacou.Modules.Stats.Projections;

/// <summary>
/// The rebuilds one request may still do (ADR 0081, Part 2): a round's projection or a frozen MVP count each take one.
/// Scoped, so every group a request reads (the season of <c>/v1/me/stats</c>, the export) shares it.
/// </summary>
internal sealed class RebuildBudget(IOptions<StatsRebuildOptions> options)
{
    private int _spent;

    /// <summary>True, and one fewer left, while the request has rebuilds left.</summary>
    public bool TryTake() => Interlocked.Increment(ref _spent) <= options.Value.MaxRebuildsPerRequest;
}
