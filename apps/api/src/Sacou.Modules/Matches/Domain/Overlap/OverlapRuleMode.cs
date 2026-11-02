using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.Overlap;

internal sealed record OverlapRuleMode
{
    public static readonly OverlapRuleMode Fivb2025To28 = new("fivb-2025-28");
    public static readonly OverlapRuleMode Classic = new("classic");

    public static readonly ImmutableArray<OverlapRuleMode> All = [Fivb2025To28, Classic];

    /// <summary>For whoever configures a group. The validator never applies it: a mode is always required.</summary>
    public static readonly OverlapRuleMode DefaultMode = Fivb2025To28;

    private OverlapRuleMode(string code) => Code = code;

    public string Code { get; }
}
