using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Writes;

/// <summary>
/// What a stream tells about who writes it, without its envelopes: the writer of every batch, how many events it has
/// and the largest sequence of a device (ADR 0063, D1 and D8). Enough for a takeover and for refusing a phone that does
/// not write the current batch, read under the lock with no envelope (ADR 0081).
/// </summary>
internal interface IWrittenStream
{
    /// <summary>The writer of the current batch; null only for a stream that does not exist yet.</summary>
    CourtWriter? Writer { get; }

    long EventCount { get; }

    /// <summary>The largest sequence of the device in the stream, across batches; 0 when it never wrote.</summary>
    long LastSequenceOf(string deviceId);

    /// <summary>Whether the device and the member are the writer of the current batch.</summary>
    bool IsCurrentWriter(string deviceId, string memberId);

    /// <summary>
    /// The latest earlier batch that this device, held by this member, wrote; null when the pair never
    /// wrote one, or writes only the current batch. The pair is the writer: the same phone with another
    /// login, or the same member on another phone, is someone else (ADR 0063, D3 and D8).
    /// </summary>
    CourtWriter? PreviousWriterOf(string deviceId, string memberId);
}

/// <summary>The writer of every batch of a stream, by batch (ADR 0060, D4; ADR 0063, D1).</summary>
internal sealed class CourtWriterHistory
{
    public static readonly CourtWriterHistory None = new([]);

    private const long NoEvents = 0;

    private CourtWriterHistory(ImmutableArray<CourtWriter> writers)
    {
        Writers = writers;
        Writer = writers.IsEmpty ? null : writers[^1];
    }

    /// <summary>The writer of each batch, oldest first; the last one writes the current batch.</summary>
    public ImmutableArray<CourtWriter> Writers { get; }

    public CourtWriter? Writer { get; }

    /// <summary>How many events the stream had when the current batch began; 0 for a stream that does not exist yet.</summary>
    public long EventsBeforeCurrentBatch => Writer?.EventsBefore ?? NoEvents;

    /// <summary>
    /// A stored stream always has a writer; its batches are unique by number, which the database enforces. The
    /// writers come in any order and are kept by batch.
    /// </summary>
    public static CourtWriterHistory Of(ImmutableArray<CourtWriter> writers)
    {
        if (writers.IsDefaultOrEmpty)
        {
            throw new ArgumentException("A stored stream has the writer of its first batch.", nameof(writers));
        }

        return new CourtWriterHistory([.. writers.OrderBy(writer => writer.Batch)]);
    }

    public CourtWriter? PreviousWriterOf(string deviceId, string memberId) =>
        Writers
            .Where(writer => writer.Batch != Writer?.Batch && IsThePair(writer, deviceId, memberId))
            .LastOrDefault();

    public bool IsCurrentWriter(string deviceId, string memberId) =>
        Writer is { } writer && IsThePair(writer, deviceId, memberId);

    private static bool IsThePair(CourtWriter writer, string deviceId, string memberId) =>
        string.Equals(writer.DeviceId, deviceId, StringComparison.Ordinal)
        && string.Equals(writer.MemberId, memberId, StringComparison.Ordinal);

    public override string ToString() => nameof(CourtWriterHistory);
}

/// <summary>
/// A stored stream known only by its writers, its count and the largest sequence of one device, read under the lock
/// with no envelope (ADR 0081): what a takeover, or the refusal of a phone that does not write, needs.
/// </summary>
internal sealed class WrittenStream : IWrittenStream
{
    private readonly CourtWriterHistory _writers;
    private readonly string _deviceId;
    private readonly long _lastSequence;

    public WrittenStream(CourtWriterHistory writers, long eventCount, string deviceId, long lastSequenceOfDevice)
    {
        ArgumentNullException.ThrowIfNull(writers);
        ArgumentNullException.ThrowIfNull(deviceId);
        _writers = writers;
        EventCount = eventCount;
        _deviceId = deviceId;
        _lastSequence = lastSequenceOfDevice;
    }

    public CourtWriter? Writer => _writers.Writer;

    public long EventCount { get; }

    /// <summary>Only the device it was read for: any other is a mistake of the caller, never a 0.</summary>
    public long LastSequenceOf(string deviceId) =>
        string.Equals(deviceId, _deviceId, StringComparison.Ordinal)
            ? _lastSequence
            : throw new ArgumentException("Only the sequence of the device read is known.", nameof(deviceId));

    public bool IsCurrentWriter(string deviceId, string memberId) => _writers.IsCurrentWriter(deviceId, memberId);

    public CourtWriter? PreviousWriterOf(string deviceId, string memberId) => _writers.PreviousWriterOf(deviceId, memberId);

    public override string ToString() => nameof(WrittenStream);
}

/// <summary>
/// The stream as stored, read under its lock: the snapshot of its events (ADR 0081) and the writer of every batch, or
/// none when the stream does not exist yet (ADR 0060, D4 and D6; ADR 0063, D1).
/// </summary>
internal sealed class StoredStream : IWrittenStream
{
    public static readonly StoredStream New = new(StreamSnapshot.Empty, CourtWriterHistory.None);

    private readonly CourtWriterHistory _writers;

    private StoredStream(StreamSnapshot snapshot, CourtWriterHistory writers)
    {
        Snapshot = snapshot;
        _writers = writers;
    }

    public StreamSnapshot Snapshot { get; }

    /// <summary>The writer of each batch, oldest first; the last one writes the current batch.</summary>
    public ImmutableArray<CourtWriter> Writers => _writers.Writers;

    public CourtWriter? Writer => _writers.Writer;

    public long EventCount => Snapshot.Version;

    public long TotalBytes => Snapshot.TotalBytes;

    /// <summary>How many events the stream had when the current batch began; 0 for a stream that does not exist yet.</summary>
    public long EventsBeforeCurrentBatch => _writers.EventsBeforeCurrentBatch;

    /// <summary>A stored stream from its events in position order, replayed here: for tests and the projections.</summary>
    public static StoredStream Of(ImmutableArray<StreamEvent> events, ImmutableArray<CourtWriter> writers)
    {
        var writerHistory = CourtWriterHistory.Of(writers);
        if (events.IsDefaultOrEmpty)
        {
            return new StoredStream(StreamSnapshot.Empty, writerHistory);
        }

        return new StoredStream(StreamSnapshot.Empty.Advance(events[0].Envelope.CourtSessionId, events), writerHistory);
    }

    public static StoredStream Of(StreamSnapshot snapshot, ImmutableArray<CourtWriter> writers)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        return new StoredStream(snapshot, CourtWriterHistory.Of(writers));
    }

    public StreamEvent? Find(string eventId) => Snapshot.Find(eventId);

    public long LastSequenceOf(string deviceId) => Snapshot.LastSequenceOf(deviceId);

    public CourtWriter? PreviousWriterOf(string deviceId, string memberId) => _writers.PreviousWriterOf(deviceId, memberId);

    public bool IsCurrentWriter(string deviceId, string memberId) => _writers.IsCurrentWriter(deviceId, memberId);

    public override string ToString() => nameof(StoredStream);
}
