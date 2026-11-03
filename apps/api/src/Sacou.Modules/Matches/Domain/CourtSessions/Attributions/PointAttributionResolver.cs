using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Attributions;

/// <summary>
/// Who scored an active point, and how, by the last valid <c>PointAttributed</c> that points at it.
/// Only ids, in the key order of <c>attributions/types.ts</c>.
/// </summary>
internal sealed record PointAttribution(
    string PointEventId,
    string MatchId,
    int SetNumber,
    TeamSide Team,
    PointKind Kind,
    string? Author);

/// <summary>Port of <c>attributions/resolve.ts</c>.</summary>
internal static class PointAttributionResolver
{
    /// <summary>
    /// Who scored each active point of the timeline, in the order of the points, and only the points
    /// with a valid attribution. The last valid one in the canonical order wins, wherever it is in
    /// relation to the point; an invalid one is ignored. Linear: one dictionary of points and one of
    /// attributions, where a later entry of a key replaces the earlier one.
    /// </summary>
    public static ImmutableArray<PointAttribution> Resolve(ReplayedTimeline<CourtSessionState> timeline)
    {
        ImmutableArray<ScoredPoint> points = [.. timeline.Entries.SelectMany(ScoredPointOf)];
        var pointsById = points.ToImmutableDictionary(point => point.EventId, StringComparer.Ordinal);
        var latestByPoint = timeline.Entries
            .SelectMany(AttributionOf)
            .Where(attribution => IsValidFor(pointsById.GetValueOrDefault(attribution.PointEventId), attribution))
            .Aggregate(
                ImmutableDictionary.Create<string, PointAttributedPayload>(StringComparer.Ordinal),
                (latest, attribution) => latest.SetItem(attribution.PointEventId, attribution));

        return
        [
            .. points
                .Where(point => latestByPoint.ContainsKey(point.EventId))
                .Select(point => ToPointAttribution(point, latestByPoint[point.EventId])),
        ];
    }

    /// <summary>The state after a point always has its match open, because the applier accepted it there.</summary>
    private static IEnumerable<ScoredPoint> ScoredPointOf(TimelineEntry<CourtSessionState> entry)
    {
        if (!string.Equals(entry.Event.Type, ScoreEventTypes.PointScored, StringComparison.Ordinal))
        {
            return [];
        }

        var parsed = ScorePayloadParser.Parse(entry.Event.Payload, ScorePayloadShapes.PointScored, PointScoredParser.ParseFields);
        var match = entry.State.CurrentMatch;
        if (parsed.IsFailure || match is null || !string.Equals(match.MatchId, parsed.Value.MatchId, StringComparison.Ordinal))
        {
            return [];
        }

        var point = parsed.Value;
        return [new ScoredPoint(entry.Event.EventId, point.MatchId, point.SetNumber, point.Team, match.Teams.Of(point.Team))];
    }

    private static IEnumerable<PointAttributedPayload> AttributionOf(TimelineEntry<CourtSessionState> entry)
    {
        if (!string.Equals(entry.Event.Type, ScoreEventTypes.PointAttributed, StringComparison.Ordinal))
        {
            return [];
        }

        var parsed = ScorePayloadParser.Parse(entry.Event.Payload, ScorePayloadShapes.PointAttributed, PointAttributedParser.ParseFields);
        return parsed.IsSuccess ? [parsed.Value] : [];
    }

    /// <summary>
    /// The point must be active and of the same match, and the author of the team that scored it. The
    /// court of the rally is not checked again: the recorded choice stands (ADR 0031).
    /// </summary>
    private static bool IsValidFor(ScoredPoint? point, PointAttributedPayload attribution) =>
        point is not null
        && string.Equals(point.MatchId, attribution.MatchId, StringComparison.Ordinal)
        && (attribution.Author is not { } author || point.Roster.MemberIds.Contains(author, StringComparer.Ordinal));

    private static PointAttribution ToPointAttribution(ScoredPoint point, PointAttributedPayload attribution) =>
        new(point.EventId, point.MatchId, point.SetNumber, point.Team, attribution.Kind, attribution.Author);

    /// <summary>An active point, with the frozen team that scored it.</summary>
    private sealed record ScoredPoint(string EventId, string MatchId, int SetNumber, TeamSide Team, TeamRoster Roster);
}
