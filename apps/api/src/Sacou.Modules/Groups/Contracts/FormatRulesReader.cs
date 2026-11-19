using Sacou.Modules.Groups.Domain.Settings;

namespace Sacou.Modules.Groups.Contracts;

/// <summary>The format leaves of a resolved document, by their catalog path; the catalog keeps the points an integer.</summary>
internal static class FormatRulesReader
{
    public static FormatRules From(GroupSettings resolved) => new(
        ScoringEnabled: resolved.ValueOf("scoring.enabled").Boolean,
        PointsPerSet: (int)resolved.ValueOf("scoring.pointsPerSet").Number,
        QueueEnabled: resolved.ValueOf("queue.enabled").Boolean);
}
