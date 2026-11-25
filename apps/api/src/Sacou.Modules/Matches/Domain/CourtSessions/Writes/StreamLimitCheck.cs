using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Writes;

/// <summary>The ceiling a write or a takeover reached, by closed list (ADR 0060, D9; ADR 0063, D10).</summary>
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
    public const string WritersPerStream = "writers-per-stream";

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
        WritersPerStream,
    ];
}

/// <summary>One count a ceiling applies to: the ceiling, and the match, the point or the whole stream it counts.</summary>
internal sealed record StreamCounterKey(string Limit, string Key);

/// <summary>
/// Counts the stream with the new events, before any replay (ADR 0060, D8 step 6). Counted from the
/// envelopes themselves, so a count never depends on whether the replay accepts: the match of an
/// event is the <c>matchId</c> of its payload, and the match of a <c>RevertedTo</c> is the one of its
/// target. Stored events only seed the counts; the first new event over a ceiling is refused. The
/// snapshot keeps the counts of its stored events (ADR 0081); they are counted again only when those
/// events do not replay, where a stored <c>RevertedTo</c> may name an event that comes later.
/// </summary>
internal static class StreamLimitCheck
{
    private const string WholeStream = "";
    private const int OneMore = 1;

    public static CourtWriteError? FindExceeded(StreamSnapshot stored, ImmutableArray<StreamEvent> newEvents)
    {
        ArgumentNullException.ThrowIfNull(stored);
        var matchByEventId = WithMatches(stored.MatchByEventId, newEvents);
        var counts = stored.Head is null ? CountAll(stored.Events, matchByEventId) : stored.Counts;

        var bytes = stored.TotalBytes;
        long events = stored.Version;
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

    /// <summary>The <c>matchId</c> of each event that has one, added to those already known. Event ids are unique.</summary>
    public static ImmutableDictionary<string, string> WithMatches(ImmutableDictionary<string, string> known, IEnumerable<StreamEvent> events)
    {
        ArgumentNullException.ThrowIfNull(known);
        ArgumentNullException.ThrowIfNull(events);
        var builder = known.ToBuilder();
        foreach (var envelope in events.Select(item => item.Envelope))
        {
            if (ReadText(envelope.Payload, PayloadFields.MatchId) is { } matchId)
            {
                builder.Add(envelope.EventId, matchId);
            }
        }

        return builder.ToImmutable();
    }

    /// <summary>The counts of <paramref name="seed"/> plus those the events add; <paramref name="matchByEventId"/> names the match of any target.</summary>
    public static ImmutableDictionary<StreamCounterKey, int> CountAll(
        IEnumerable<StreamEvent> events,
        ImmutableDictionary<string, string> matchByEventId,
        ImmutableDictionary<StreamCounterKey, int>? seed = null)
    {
        ArgumentNullException.ThrowIfNull(events);
        var builder = (seed ?? ImmutableDictionary<StreamCounterKey, int>.Empty).ToBuilder();
        foreach (var counter in events.SelectMany(item => CountersOf(item.Envelope, matchByEventId)))
        {
            builder[counter.Key] = builder.GetValueOrDefault(counter.Key) + OneMore;
        }

        return builder.ToImmutable();
    }

    private static ImmutableDictionary<StreamCounterKey, int> Count(ImmutableDictionary<StreamCounterKey, int> counts, IEnumerable<Counter> counters) =>
        counters.Aggregate(counts, (current, counter) => current.SetItem(counter.Key, current.GetValueOrDefault(counter.Key) + OneMore));

    /// <summary>The counters one event adds to, each with its ceiling.</summary>
    private static ImmutableArray<Counter> CountersOf(EventEnvelope envelope, ImmutableDictionary<string, string> matchByEventId)
    {
        var matchId = string.Equals(envelope.Type, EventLogSchema.RevertedToEventType, StringComparison.Ordinal)
            ? ReadText(envelope.Payload, EventLogSchema.RevertTargetField) is { } target ? matchByEventId.GetValueOrDefault(target) : null
            : ReadText(envelope.Payload, PayloadFields.MatchId);
        var byType = envelope.Type switch
        {
            ScoreEventTypes.QueueChanged => CounterOf(StreamLimitNames.StreamQueueChanges, WholeStream, CourtStreamLimits.MaxStreamQueueChanges),
            ScoreEventTypes.LineupChanged => CounterOf(StreamLimitNames.MatchLineupChanges, matchId, CourtStreamLimits.MaxMatchLineupChanges),
            ScoreEventTypes.ServingTeamChanged => CounterOf(StreamLimitNames.MatchServingChanges, matchId, CourtStreamLimits.MaxMatchServingChanges),
            EventLogSchema.RevertedToEventType => CounterOf(StreamLimitNames.MatchReverts, matchId, CourtStreamLimits.MaxMatchReverts),
            ScoreEventTypes.PointAttributed => CounterOf(
                StreamLimitNames.PointAttributions,
                ReadText(envelope.Payload, PayloadFields.PointEventId),
                CourtStreamLimits.MaxPointAttributions),
            _ => null,
        };
        return [.. new[] { CounterOf(StreamLimitNames.MatchEvents, matchId, CourtStreamLimits.MaxMatchEvents), byType }.OfType<Counter>()];
    }

    /// <summary>No counter without a key: an event the parser would refuse is the replay's to refuse.</summary>
    private static Counter? CounterOf(string limit, string? key, int max) => key is null ? null : new Counter(new StreamCounterKey(limit, key), max);

    private static string? ReadText(RawObject payload, string field) =>
        payload.TryGetMember(field, out var value) && value is RawString text ? text.Value : null;

    private sealed record Counter(StreamCounterKey Key, int Max);
}
