using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Writes;

/// <summary>
/// The stream as stored, read under its lock: the events in arrival order and the writer of every
/// batch, or none when the stream does not exist yet (ADR 0060, D4 and D6; ADR 0063, D1).
/// </summary>
internal sealed class StoredStream
{
    public static readonly StoredStream New = new([], writers: []);

    private const long NoSequence = 0;
    private const long NoEvents = 0;

    private readonly ImmutableDictionary<string, StreamEvent> _byEventId;

    private StoredStream(ImmutableArray<StreamEvent> events, ImmutableArray<CourtWriter> writers)
    {
        Events = events;
        Writers = writers;
        Writer = writers.IsEmpty ? null : writers[^1];
        _byEventId = events.ToImmutableDictionary(item => item.Envelope.EventId, StringComparer.Ordinal);
        TotalBytes = events.Sum(item => item.ByteCount);
    }

    public ImmutableArray<StreamEvent> Events { get; }

    /// <summary>The writer of each batch, oldest first; the last one writes the current batch.</summary>
    public ImmutableArray<CourtWriter> Writers { get; }

    /// <summary>The writer of the current batch; null only for a stream that does not exist yet.</summary>
    public CourtWriter? Writer { get; }

    public long TotalBytes { get; }

    /// <summary>How many events the stream had when the current batch began; 0 for a stream that does not exist yet.</summary>
    public long EventsBeforeCurrentBatch => Writer?.EventsBefore ?? NoEvents;

    /// <summary>
    /// A stored stream always has a writer; its events are unique by id and its batches by number, which
    /// the database enforces. The writers come in any order and are kept by batch.
    /// </summary>
    public static StoredStream Of(ImmutableArray<StreamEvent> events, ImmutableArray<CourtWriter> writers)
    {
        if (writers.IsDefaultOrEmpty)
        {
            throw new ArgumentException("A stored stream has the writer of its first batch.", nameof(writers));
        }

        return new StoredStream(events, [.. writers.OrderBy(writer => writer.Batch)]);
    }

    public StreamEvent? Find(string eventId) => _byEventId.GetValueOrDefault(eventId);

    /// <summary>The largest sequence of the device in the stream, across batches; 0 when it never wrote.</summary>
    public long LastSequenceOf(string deviceId) =>
        Events
            .Where(item => string.Equals(item.Envelope.DeviceId, deviceId, StringComparison.Ordinal))
            .Select(item => item.Envelope.Sequence)
            .DefaultIfEmpty(NoSequence)
            .Max();

    /// <summary>
    /// The latest earlier batch that this device, held by this member, wrote; null when the pair never
    /// wrote one, or writes only the current batch. The pair is the writer: the same phone with another
    /// login, or the same member on another phone, is someone else (ADR 0063, D3 and D8).
    /// </summary>
    public CourtWriter? PreviousWriterOf(string deviceId, string memberId) =>
        Writers
            .Where(writer => writer.Batch != Writer?.Batch && IsThePair(writer, deviceId, memberId))
            .LastOrDefault();

    /// <summary>Whether the device and the member are the writer of the current batch.</summary>
    public bool IsCurrentWriter(string deviceId, string memberId) =>
        Writer is { } writer && IsThePair(writer, deviceId, memberId);

    private static bool IsThePair(CourtWriter writer, string deviceId, string memberId) =>
        string.Equals(writer.DeviceId, deviceId, StringComparison.Ordinal)
        && string.Equals(writer.MemberId, memberId, StringComparison.Ordinal);

    public override string ToString() => nameof(StoredStream);
}
