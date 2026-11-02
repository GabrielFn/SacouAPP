using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.Overlap;

/// <summary>
/// A closed set of outcomes. Not a Result of Shared: its Error holds no list of violations, and a
/// success carrying violations would be a trap for callers (ADR 0025).
/// </summary>
internal abstract record OverlapResult
{
    private OverlapResult()
    {
    }

    /// <summary>The relations in force for that mode and phase, which all held.</summary>
    public sealed record Passed(ImmutableArray<OverlapRelation> Checked) : OverlapResult;

    public sealed record Violated(ImmutableArray<OverlapRelation> Violations) : OverlapResult;

    public sealed record InvalidTolerance : OverlapResult;
}
