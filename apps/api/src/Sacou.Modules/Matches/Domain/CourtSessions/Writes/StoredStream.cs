using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Writes;

/// <summary>
/// The stream as stored, read under its lock: the events in arrival order and the writer of the
/// current batch, or none when the stream does not exist yet (ADR 0060, D4 and D6).
/// </summary>
internal sealed class StoredStream
{
    public static readonly StoredStream New = new([], writer: null);

    private const long NoSequence = 0;

    private readonly ImmutableDictionary<string, StreamEvent> _byEventId;

    private StoredStream(ImmutableArray<StreamEvent> events, CourtWriter? writer)
    {
        Events = events;
        Writer = writer;
        _byEventId = events.ToImmutableDictionary(item => item.Envelope.EventId, StringComparer.Ordinal);
        TotalBytes = events.Sum(item => item.ByteCount);
    }

    public ImmutableArray<StreamEvent> Events { get; }

    /// <summary>The writer of the current batch; null only for a stream that does not exist yet.</summary>
    public CourtWriter? Writer { get; }

    public long TotalBytes { get; }

    /// <summary>A stored stream always has its writer; its events are unique by id, which the database enforces.</summary>
    public static StoredStream Of(ImmutableArray<StreamEvent> events, CourtWriter writer) => new(events, writer);

    public StreamEvent? Find(string eventId) => _byEventId.GetValueOrDefault(eventId);

    /// <summary>The largest sequence of the device in the stream, across batches; 0 when it never wrote.</summary>
    public long LastSequenceOf(string deviceId) =>
        Events
            .Where(item => string.Equals(item.Envelope.DeviceId, deviceId, StringComparison.Ordinal))
            .Select(item => item.Envelope.Sequence)
            .DefaultIfEmpty(NoSequence)
            .Max();

    public override string ToString() => nameof(StoredStream);
}
