using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;

namespace Sacou.Modules.Matches.Infrastructure;

/// <summary>How a snapshot came to be: as it was, advanced by the events after it, or built from the whole stream.</summary>
internal enum SnapshotUse
{
    Hit,
    Advanced,
    Built,
}

/// <summary>Where a snapshot is brought up to the stored stream; scoped, like the database it reads.</summary>
internal interface ICourtSnapshotSource
{
    /// <summary>The snapshot of the stream from <paramref name="from"/>, or from nothing when null.</summary>
    Task<ReadSnapshot> ReadAsync(Guid courtSessionId, StreamSnapshot? from, CancellationToken cancellationToken);

    /// <summary>
    /// Only the events after <paramref name="from"/>, never the whole stream: null when its last event is not there any
    /// more, so it must be built again (under the stream's lock, a 503 instead, ADR 0081 Part 2). Without
    /// <paramref name="checkLastEvent"/> only its position is checked: for a snapshot this very call built from the
    /// database a moment ago, whose last event is the stored one by construction.
    /// </summary>
    Task<ReadSnapshot?> AdvanceAsync(Guid courtSessionId, StreamSnapshot from, bool checkLastEvent, CancellationToken cancellationToken);
}

/// <summary>A snapshot read from the database, and how (ADR 0081).</summary>
internal sealed record ReadSnapshot(StreamSnapshot Snapshot, SnapshotUse Use)
{
    public override string ToString() => $"{nameof(ReadSnapshot)}({Use})";
}

/// <summary>
/// Brings a snapshot up to the stored stream (ADR 0081): reads the positions from the one of its last event, checks that
/// this event is still the one there, and replays only the events after it. A snapshot whose last event is not there
/// any more (the database was rebuilt, or changed outside the API) is thrown away and the whole stream read again. In
/// the transaction of the context when there is one, so under the stream's lock it reads what the lock holds.
/// </summary>
internal sealed class CourtSnapshotReader(MatchesDbContext database) : ICourtSnapshotSource
{
    private const int NoVersion = 0;
    private const int TheCheckedOne = 1;

    private static readonly UTF8Encoding StrictUtf8 = new(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);

    public async Task<ReadSnapshot> ReadAsync(Guid courtSessionId, StreamSnapshot? from, CancellationToken cancellationToken)
    {
        if (from is not null && from.Version != NoVersion
            && await AdvanceAsync(courtSessionId, from, checkLastEvent: true, cancellationToken).ConfigureAwait(false) is { } advanced)
        {
            return advanced;
        }

        var all = await RowsFromAsync(courtSessionId, NoVersion, cancellationToken).ConfigureAwait(false);
        return new ReadSnapshot(Advance(StreamSnapshot.Empty, courtSessionId, all), SnapshotUse.Built);
    }

    public async Task<ReadSnapshot?> AdvanceAsync(Guid courtSessionId, StreamSnapshot from, bool checkLastEvent, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(from);
        var version = from.Version;
        var rows = await RowsFromAsync(courtSessionId, version, cancellationToken).ConfigureAwait(false);
        if (version == NoVersion)
        {
            return rows.Count == 0 ? new ReadSnapshot(from, SnapshotUse.Hit) : new ReadSnapshot(Advance(from, courtSessionId, rows), SnapshotUse.Advanced);
        }

        if (rows.Count == 0 || rows[0].Position != version
            || (checkLastEvent && !string.Equals(Text(rows[0].EventId), from.LastStoredEventId, StringComparison.Ordinal)))
        {
            return null;
        }

        var after = rows.Skip(TheCheckedOne).ToList();
        return after.Count == 0
            ? new ReadSnapshot(from, SnapshotUse.Hit)
            : new ReadSnapshot(Advance(from, courtSessionId, after), SnapshotUse.Advanced);
    }

    private static StreamSnapshot Advance(StreamSnapshot from, Guid courtSessionId, IReadOnlyList<StoredRow> rows) =>
        from.Advance(Text(courtSessionId), [.. rows.Select(row => Parse(courtSessionId, row.Envelope))]);

    private async Task<List<StoredRow>> RowsFromAsync(Guid courtSessionId, int fromPosition, CancellationToken cancellationToken) =>
        await database.CourtEvents.AsNoTracking()
            .Where(row => row.CourtSessionId == courtSessionId && row.Position >= fromPosition)
            .OrderBy(row => row.Position)
            .Select(row => new StoredRow(row.Position, row.EventId, row.Envelope))
            .ToListAsync(cancellationToken).ConfigureAwait(false);

    /// <summary>The same reader and parser as a request (ADR 0060, D13); the byte count is the one counted on arrival.</summary>
    public static StreamEvent Parse(Guid courtSessionId, string envelope)
    {
        Result<EventEnvelope, EnvelopeError> parsed;
        try
        {
            parsed = EnvelopeParser.Parse(RawValueReader.Parse(envelope));
        }
        catch (JsonException)
        {
            throw new CorruptCourtStreamException(courtSessionId);
        }

        return parsed.IsSuccess
            ? new StreamEvent(parsed.Value, StrictUtf8.GetByteCount(envelope))
            : throw new CorruptCourtStreamException(courtSessionId);
    }

    /// <summary>The lowercase 8-4-4-4-12 form the parser accepts.</summary>
    private static string Text(Guid id) => id.ToString("D");

    private sealed record StoredRow(int Position, Guid EventId, string Envelope);
}
