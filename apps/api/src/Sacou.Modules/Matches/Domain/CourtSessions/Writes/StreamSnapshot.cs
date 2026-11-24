using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.Appliers;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Writes;

/// <summary>
/// The stored events of a stream already replayed and counted (ADR 0081), so that a write reads, parses and replays only
/// the events after them. Immutable: <see cref="Advance"/> and <see cref="With"/> return a new snapshot and share the
/// rest. The stream is append only, so the content up to <see cref="Version"/> never changes: the version is the key.
/// Holds the events in position order, each by id, the largest sequence of each device, the bytes, the match of each
/// event, the counts of the ceilings, the active timeline (null when the stored events do not replay, which sends every
/// later write to the replay of the whole stream, as before the snapshot), and the last event in canonical order.
/// </summary>
internal sealed class StreamSnapshot : IReplayCheckpoint<CourtSessionState>
{
    public static readonly StreamSnapshot Empty = new(
        [],
        ImmutableDictionary<string, StreamEvent>.Empty.WithComparers(StringComparer.Ordinal),
        ImmutableDictionary<string, long>.Empty.WithComparers(StringComparer.Ordinal),
        totalBytes: 0,
        ImmutableDictionary<string, string>.Empty.WithComparers(StringComparer.Ordinal),
        ImmutableDictionary<StreamCounterKey, int>.Empty,
        Timeline<CourtSessionState>.Empty,
        lastEvent: null);

    private const long NoSequence = 0;

    private readonly ImmutableDictionary<string, StreamEvent> _byEventId;
    private readonly ImmutableDictionary<string, long> _lastSequenceByDevice;

    private StreamSnapshot(
        ImmutableList<StreamEvent> events,
        ImmutableDictionary<string, StreamEvent> byEventId,
        ImmutableDictionary<string, long> lastSequenceByDevice,
        long totalBytes,
        ImmutableDictionary<string, string> matchByEventId,
        ImmutableDictionary<StreamCounterKey, int> counts,
        Timeline<CourtSessionState>? head,
        EventEnvelope? lastEvent)
    {
        Events = events;
        _byEventId = byEventId;
        _lastSequenceByDevice = lastSequenceByDevice;
        TotalBytes = totalBytes;
        MatchByEventId = matchByEventId;
        Counts = counts;
        Head = head;
        LastEvent = lastEvent;
    }

    /// <summary>The stored events in position order: event <c>n</c> is at position <c>n</c>, from 1.</summary>
    public ImmutableList<StreamEvent> Events { get; }

    /// <summary>How many stored events the snapshot holds: the position of its last one.</summary>
    public int Version => Events.Count;

    /// <summary>The id of the event at position <see cref="Version"/>, which the store checks against the database; null with no event.</summary>
    public string? LastStoredEventId => Events.IsEmpty ? null : Events[^1].Envelope.EventId;

    public long TotalBytes { get; }

    public ImmutableDictionary<string, string> MatchByEventId { get; }

    /// <summary>The counts of the ceilings over the stored events; meaningful only with a <see cref="Head"/>.</summary>
    public ImmutableDictionary<StreamCounterKey, int> Counts { get; }

    public Timeline<CourtSessionState>? Head { get; }

    public EventEnvelope? LastEvent { get; }

    IEnumerable<EventEnvelope> IReplayCheckpoint<CourtSessionState>.StoredEvents => Events.Select(item => item.Envelope);

    public bool IsStored(string eventId) => _byEventId.ContainsKey(eventId);

    public StreamEvent? Find(string eventId) => _byEventId.GetValueOrDefault(eventId);

    /// <summary>The largest sequence of the device in the stream, across batches; 0 when it never wrote.</summary>
    public long LastSequenceOf(string deviceId) => _lastSequenceByDevice.GetValueOrDefault(deviceId, NoSequence);

    /// <summary>
    /// Whether events after these continue the replay from <see cref="Head"/> with the outcome of the replay of the
    /// whole stream: the stored events replay, and the new ones come after all of them by order key, with new ids.
    /// </summary>
    public bool Continues(string courtSessionId, ImmutableArray<EventEnvelope> newEvents) =>
        Head is not null && EventReplayer.Follows(courtSessionId, this, newEvents);

    /// <summary>
    /// The snapshot with the events stored at the next positions, in position order, replayed: from the head when they
    /// continue it, otherwise the whole stream again. Stored events that do not replay leave no head.
    /// </summary>
    public StreamSnapshot Advance(string courtSessionId, IReadOnlyList<StreamEvent> stored)
    {
        ArgumentNullException.ThrowIfNull(courtSessionId);
        ArgumentNullException.ThrowIfNull(stored);
        if (stored.Count == 0)
        {
            return this;
        }

        ImmutableArray<EventEnvelope> envelopes = [.. stored.Select(item => item.Envelope)];
        if (!Continues(courtSessionId, envelopes))
        {
            // Empty always continues: its head is the empty timeline and it has no last event.
            return Empty.Advance(courtSessionId, [.. Events, .. stored]);
        }

        var replayed = EventReplayer.ContinueSteps(ScoreAppliers.Config(courtSessionId), this, envelopes, NotTracked);
        return Extend(stored, replayed.IsSuccess ? replayed.Value.Head : null);
    }

    /// <summary>The snapshot after a write whose new events continued this one (<see cref="Continues"/>) to <paramref name="head"/>.</summary>
    public StreamSnapshot With(IReadOnlyList<StreamEvent> newEvents, Timeline<CourtSessionState> head)
    {
        ArgumentNullException.ThrowIfNull(newEvents);
        ArgumentNullException.ThrowIfNull(head);
        return Extend(newEvents, head);
    }

    private static bool NotTracked(EventEnvelope envelope) => false;

    private StreamSnapshot Extend(IReadOnlyList<StreamEvent> added, Timeline<CourtSessionState>? head)
    {
        var byEventId = _byEventId.ToBuilder();
        var lastSequences = _lastSequenceByDevice.ToBuilder();
        var lastEvent = LastEvent;
        foreach (var item in added)
        {
            var envelope = item.Envelope;
            byEventId.Add(envelope.EventId, item);
            lastSequences[envelope.DeviceId] = Math.Max(lastSequences.GetValueOrDefault(envelope.DeviceId, NoSequence), envelope.Sequence);
            lastEvent = lastEvent is null || CanonicalOrder.Instance.Compare(lastEvent, envelope) < 0 ? envelope : lastEvent;
        }

        var matchByEventId = StreamLimitCheck.WithMatches(MatchByEventId, added);
        return new StreamSnapshot(
            Events.AddRange(added),
            byEventId.ToImmutable(),
            lastSequences.ToImmutable(),
            TotalBytes + added.Sum(item => item.ByteCount),
            matchByEventId,
            StreamLimitCheck.CountAll(added, matchByEventId, Counts),
            head,
            lastEvent);
    }

    /// <summary>Never the events: their device ids and payloads are received content (ADR 0060, D15).</summary>
    public override string ToString() => $"{nameof(StreamSnapshot)}({Version})";
}
