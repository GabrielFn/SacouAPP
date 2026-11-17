using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Writes;

/// <summary>The ceiling a write reached, by closed list (ADR 0060, D9).</summary>
internal static class StreamLimitNames
{
    public const string StreamEvents = "stream-events";
    public const string StreamBytes = "stream-bytes";
    public const string StreamQueueChanges = "stream-queue-changes";
    public const string MatchEvents = "match-events";
    public const string MatchLineupChanges = "match-lineup-changes";
    public const string MatchServingChanges = "match-serving-changes";
    public const string MatchReverts = "match-reverts";
    public const string PointAttributions = "point-attributions";

    public static readonly ImmutableArray<string> All =
    [
        StreamEvents,
        StreamBytes,
        StreamQueueChanges,
        MatchEvents,
        MatchLineupChanges,
        MatchServingChanges,
        MatchReverts,
        PointAttributions,
    ];
}

/// <summary>
/// Counts the stream with the new events, before any replay (ADR 0060, D8 step 6). Counted from the
/// envelopes themselves, so a count never depends on whether the replay accepts: the match of an
/// event is the <c>matchId</c> of its payload, and the match of a <c>RevertedTo</c> is the one of its
/// target. Stored events only seed the counts; the first new event over a ceiling is refused.
/// </summary>
internal static class StreamLimitCheck
{
    private const string WholeStream = "";
    private const int OneMore = 1;

    public static CourtWriteError? FindExceeded(StoredStream stored, ImmutableArray<StreamEvent> newEvents)
    {
        var matchByEventId = stored.Events.Concat(newEvents)
            .Select(item => item.Envelope)
            .Where(envelope => ReadText(envelope.Payload, PayloadFields.MatchId) is not null)
            .ToImmutableDictionary(envelope => envelope.EventId, envelope => ReadText(envelope.Payload, PayloadFields.MatchId)!, StringComparer.Ordinal);
        var counts = stored.Events.Aggregate(
            ImmutableDictionary<CounterKey, int>.Empty,
            (current, item) => Count(current, CountersOf(item.Envelope, matchByEventId)));

        var bytes = stored.TotalBytes;
        var events = stored.Events.Length;
        foreach (var item in newEvents)
        {
            events += OneMore;
            bytes += item.ByteCount;
            var counters = CountersOf(item.Envelope, matchByEventId);
            counts = Count(counts, counters);
            var exceeded = events > CourtStreamLimits.MaxStreamEvents ? StreamLimitNames.StreamEvents
                : bytes > CourtStreamLimits.MaxStreamBytes ? StreamLimitNames.StreamBytes
                : counters.FirstOrDefault(counter => counts[counter.Key] > counter.Max)?.Key.Limit;
            if (exceeded is not null)
            {
                return new CourtWriteError(CourtWriteErrorCode.LimitReached, item.Envelope.EventId, Limit: exceeded);
            }
        }

        return null;
    }

    private static ImmutableDictionary<CounterKey, int> Count(ImmutableDictionary<CounterKey, int> counts, IEnumerable<Counter> counters) =>
        counters.Aggregate(counts, (current, counter) => current.SetItem(counter.Key, current.GetValueOrDefault(counter.Key) + OneMore));

    /// <summary>The counters one event adds to, each with its ceiling.</summary>
    private static ImmutableArray<Counter> CountersOf(EventEnvelope envelope, ImmutableDictionary<string, string> matchByEventId)
    {
        var matchId = string.Equals(envelope.Type, EventLogSchema.RevertedToEventType, StringComparison.Ordinal)
            ? ReadText(envelope.Payload, EventLogSchema.RevertTargetField) is { } target ? matchByEventId.GetValueOrDefault(target) : null
            : ReadText(envelope.Payload, PayloadFields.MatchId);
        var byType = envelope.Type switch
        {
            ScoreEventTypes.QueueChanged => Counter(StreamLimitNames.StreamQueueChanges, WholeStream, CourtStreamLimits.MaxStreamQueueChanges),
            ScoreEventTypes.LineupChanged => Counter(StreamLimitNames.MatchLineupChanges, matchId, CourtStreamLimits.MaxMatchLineupChanges),
            ScoreEventTypes.ServingTeamChanged => Counter(StreamLimitNames.MatchServingChanges, matchId, CourtStreamLimits.MaxMatchServingChanges),
            EventLogSchema.RevertedToEventType => Counter(StreamLimitNames.MatchReverts, matchId, CourtStreamLimits.MaxMatchReverts),
            ScoreEventTypes.PointAttributed => Counter(
                StreamLimitNames.PointAttributions,
                ReadText(envelope.Payload, PayloadFields.PointEventId),
                CourtStreamLimits.MaxPointAttributions),
            _ => null,
        };
        return [.. new[] { Counter(StreamLimitNames.MatchEvents, matchId, CourtStreamLimits.MaxMatchEvents), byType }.OfType<Counter>()];
    }

    /// <summary>No counter without a key: an event the parser would refuse is the replay's to refuse.</summary>
    private static Counter? Counter(string limit, string? key, int max) => key is null ? null : new Counter(new CounterKey(limit, key), max);

    private static string? ReadText(RawObject payload, string field) =>
        payload.TryGetMember(field, out var value) && value is RawString text ? text.Value : null;

    private sealed record CounterKey(string Limit, string Key);

    private sealed record Counter(CounterKey Key, int Max);
}
