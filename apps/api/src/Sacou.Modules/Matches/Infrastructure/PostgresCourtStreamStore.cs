using System.Collections.Immutable;
using System.Data;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;

namespace Sacou.Modules.Matches.Infrastructure;

/// <summary>
/// The one lock is the stream's row (ADR 0060, D6). SQL is always parameterized: EF turns the interpolated
/// values into parameters (ADR 0037). Reads outside the lock use <c>AsNoTracking</c>.
/// </summary>
internal sealed class PostgresCourtStreamStore(MatchesDbContext database) : ICourtStreamStore, ICourtEventStore, ICourtWriterReader
{
    private const int FirstPosition = 1;

    private static readonly UTF8Encoding StrictUtf8 = new(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);

    public Task<CourtStreamOutcome<CourtWriteDecision>> AppendAsync(
        CourtAppend append,
        Func<StoredStream, Result<CourtWriteDecision, CourtWriteError>> decide,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(append);
        ArgumentNullException.ThrowIfNull(decide);
        return InTransactionAsync(
            () => AppendUnderLockAsync(append, decide, cancellationToken),
            decision => !decision.NewEvents.IsEmpty,
            cancellationToken);
    }

    public Task<CourtStreamOutcome<CourtTakeoverDecision>> TakeOverAsync(
        CourtTakeoverCall call,
        Func<StoredStream, Result<CourtTakeoverDecision, CourtWriteError>> decide,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(call);
        ArgumentNullException.ThrowIfNull(decide);
        return InTransactionAsync(
            () => TakeOverUnderLockAsync(call, decide, cancellationToken),
            decision => decision.OpensBatch,
            cancellationToken);
    }

    /// <summary>Commits only an accepted decision that stores something; any other way out rolls back.</summary>
    private async Task<CourtStreamOutcome<TDecision>> InTransactionAsync<TDecision>(
        Func<Task<CourtStreamOutcome<TDecision>>> underLock, Func<TDecision, bool> stores, CancellationToken cancellationToken)
        where TDecision : class
    {
        // EF opens no transaction for raw SQL by itself: without this one, FOR UPDATE would lock nothing.
        var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            var outcome = await underLock().ConfigureAwait(false);
            if (outcome.Decided is { IsSuccess: true } decided && stores(decided.Value))
            {
                await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            }

            return outcome;
        }
    }

    private async Task<CourtStreamOutcome<CourtWriteDecision>> AppendUnderLockAsync(
        CourtAppend append,
        Func<StoredStream, Result<CourtWriteDecision, CourtWriteError>> decide,
        CancellationToken cancellationToken)
    {
        var created = append.MayCreate && await TryCreateAsync(append, cancellationToken).ConfigureAwait(false);
        var session = await LockAsync(append.CourtSessionId, cancellationToken).ConfigureAwait(false);
        if (session is null)
        {
            // Not created: either the round is canceled, or the insert met the other stream of the round.
            return CourtStreamOutcome<CourtWriteDecision>.Refused(
                append.MayCreate ? CourtStreamRefusal.RoundHasCourtSession : CourtStreamRefusal.RoundCanceled);
        }

        if (!BelongsTo(session, append.GroupId, append.RoundId))
        {
            return CourtStreamOutcome<CourtWriteDecision>.Refused(CourtStreamRefusal.CourtSessionNotFound);
        }

        var stored = created ? StoredStream.New : await LoadStoredAsync(session, cancellationToken).ConfigureAwait(false);
        var decided = decide(stored);
        if (decided.IsSuccess && !decided.Value.NewEvents.IsEmpty)
        {
            await WriteAsync(append, session, decided.Value, cancellationToken).ConfigureAwait(false);
        }

        return CourtStreamOutcome<CourtWriteDecision>.From(decided);
    }

    /// <summary>
    /// The role is asked again only once the lock is held: a member made a player between the filter and the lock
    /// does not take the court (ADR 0063, D4). A stream of another round or group is the same 404 as none.
    /// </summary>
    private async Task<CourtStreamOutcome<CourtTakeoverDecision>> TakeOverUnderLockAsync(
        CourtTakeoverCall call,
        Func<StoredStream, Result<CourtTakeoverDecision, CourtWriteError>> decide,
        CancellationToken cancellationToken)
    {
        var session = await LockAsync(call.CourtSessionId, cancellationToken).ConfigureAwait(false);
        if (session is null || !BelongsTo(session, call.GroupId, call.RoundId))
        {
            return CourtStreamOutcome<CourtTakeoverDecision>.Refused(CourtStreamRefusal.CourtSessionNotFound);
        }

        if (!await call.StillMayWrite(cancellationToken).ConfigureAwait(false))
        {
            return CourtStreamOutcome<CourtTakeoverDecision>.Refused(CourtStreamRefusal.Forbidden);
        }

        var decided = decide(await LoadStoredAsync(session, cancellationToken).ConfigureAwait(false));
        if (decided.IsSuccess && decided.Value.OpensBatch)
        {
            await OpenBatchAsync(call, session, decided.Value.Writer, cancellationToken).ConfigureAwait(false);
        }

        return CourtStreamOutcome<CourtTakeoverDecision>.From(decided);
    }

    private static bool BelongsTo(CourtSessionRow session, Guid groupId, Guid roundId) => session.GroupId == groupId && session.RoundId == roundId;

    /// <summary>The writer of the next batch and the new current batch, in the transaction of the lock (ADR 0063, D1).</summary>
    private async Task OpenBatchAsync(CourtTakeoverCall call, CourtSessionRow session, CourtWriter writer, CancellationToken cancellationToken)
    {
        database.CourtWriters.Add(NewWriterRow(session.Id, writer, call.Now));
        await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        _ = await database.CourtSessions
            .Where(row => row.Id == session.Id)
            .ExecuteUpdateAsync(setters => setters.SetProperty(row => row.CurrentBatch, writer.Batch), cancellationToken)
            .ConfigureAwait(false);
    }

    private static CourtWriterRow NewWriterRow(Guid courtSessionId, CourtWriter writer, DateTimeOffset now) => new()
    {
        CourtSessionId = courtSessionId,
        Batch = writer.Batch,
        DeviceId = Guid.Parse(writer.DeviceId),
        MemberId = Guid.Parse(writer.MemberId),
        EventsBefore = writer.EventsBefore,
        StartedAt = now,
    };

    /// <summary>
    /// True when this call inserted the row. With no conflict target, the insert does nothing both when the stream
    /// exists and when the round already has another one: the lock that follows tells the two apart. A concurrent
    /// insert of the same stream or round waits for the other transaction and then does nothing.
    /// </summary>
    private async Task<bool> TryCreateAsync(CourtAppend append, CancellationToken cancellationToken)
    {
        var inserted = await database.Database.ExecuteSqlAsync(
            $"""
            INSERT INTO matches.court_sessions (id, group_id, round_id, current_batch, event_count, envelope_bytes, created_at)
            VALUES ({append.CourtSessionId}, {append.GroupId}, {append.RoundId}, {CourtStreamLimits.FirstBatch}, 0, 0, {append.Now})
            ON CONFLICT DO NOTHING
            """,
            cancellationToken).ConfigureAwait(false);
        return inserted == 1;
    }

    private async Task<CourtSessionRow?> LockAsync(Guid courtSessionId, CancellationToken cancellationToken)
    {
        // Not composed: a LIMIT around it would move FOR UPDATE into a subquery.
        var rows = await database.CourtSessions
            .FromSql($"SELECT * FROM matches.court_sessions WHERE id = {courtSessionId} FOR UPDATE")
            .AsNoTracking()
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return rows.SingleOrDefault();
    }

    private async Task<StoredStream> LoadStoredAsync(CourtSessionRow session, CancellationToken cancellationToken)
    {
        var writers = await database.CourtWriters.AsNoTracking()
            .Where(row => row.CourtSessionId == session.Id)
            .OrderBy(row => row.Batch)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        // The last writer is the one of the current batch, or the stream was changed outside the API: fail closed.
        if (writers.Count == 0 || writers[^1].Batch != session.CurrentBatch)
        {
            throw new CorruptCourtStreamException(session.Id);
        }

        var events = await LoadAsync(session.Id, cancellationToken).ConfigureAwait(false);
        return StoredStream.Of(events, [.. writers.Select(row => new CourtWriter(row.Batch, Text(row.DeviceId), Text(row.MemberId), row.EventsBefore))]);
    }

    public async Task<ImmutableArray<StreamEvent>> LoadAsync(Guid courtSessionId, CancellationToken cancellationToken)
    {
        var envelopes = await database.CourtEvents.AsNoTracking()
            .Where(row => row.CourtSessionId == courtSessionId)
            .OrderBy(row => row.Position)
            .Select(row => row.Envelope)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return [.. envelopes.Select(envelope => Parse(courtSessionId, envelope))];
    }

    /// <summary>The same reader and parser as a request (ADR 0060, D13); the byte count is the one counted on arrival.</summary>
    private static StreamEvent Parse(Guid courtSessionId, string envelope)
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

    private async Task WriteAsync(CourtAppend append, CourtSessionRow session, CourtWriteDecision decision, CancellationToken cancellationToken)
    {
        if (decision.CreatesStream)
        {
            database.CourtWriters.Add(NewWriterRow(session.Id, decision.Writer, append.Now));
        }

        database.CourtEvents.AddRange(decision.NewEvents.Select((item, index) => ToRow(append, session.EventCount + FirstPosition + index, item)));
        await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await UpdateCountersAsync(append, session.Id, decision, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>The counters, the time of the last event and the scoreboard after the write, null with no open match (ADR 0063, D6).</summary>
    private async Task UpdateCountersAsync(CourtAppend append, Guid courtSessionId, CourtWriteDecision decision, CancellationToken cancellationToken)
    {
        var addedEvents = decision.NewEvents.Length;
        var addedBytes = decision.NewEvents.Sum(item => item.ByteCount);
        var board = decision.Scoreboard;
        Guid? matchId = board is null ? null : Guid.Parse(board.MatchId);
        _ = await database.CourtSessions
            .Where(row => row.Id == courtSessionId)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(row => row.EventCount, row => row.EventCount + addedEvents)
                    .SetProperty(row => row.EnvelopeBytes, row => row.EnvelopeBytes + addedBytes)
                    .SetProperty(row => row.LastEventAt, append.Now)
                    .SetProperty(row => row.OpenMatchId, matchId)
                    .SetProperty(row => row.SetNumber, board?.SetNumber)
                    .SetProperty(row => row.PointsA, board?.PointsA)
                    .SetProperty(row => row.PointsB, board?.PointsB)
                    .SetProperty(row => row.SetsA, board?.SetsA)
                    .SetProperty(row => row.SetsB, board?.SetsB),
                cancellationToken)
            .ConfigureAwait(false);
    }

    private static CourtEventRow ToRow(CourtAppend append, int position, StreamEvent item)
    {
        var envelope = item.Envelope;
        return new CourtEventRow
        {
            CourtSessionId = append.CourtSessionId,
            Position = position,
            EventId = Guid.Parse(envelope.EventId),
            Batch = envelope.Batch,
            Sequence = envelope.Sequence,
            DeviceId = Guid.Parse(envelope.DeviceId),
            SchemaVersion = envelope.SchemaVersion,
            Type = envelope.Type,
            MatchId = MatchIdOf(envelope),
            Envelope = append.EnvelopeTexts[envelope.EventId],
            ReceivedAt = append.Now,
        };
    }

    /// <summary>The <c>matchId</c> of the payload, which the replay already proved a UUID; none for a revert or a queue change.</summary>
    private static Guid? MatchIdOf(EventEnvelope envelope) =>
        envelope.Payload.TryGetMember(PayloadFields.MatchId, out var value) && value is RawString text && Guid.TryParse(text.Value, out var id)
            ? id
            : null;

    public async Task<IReadOnlyList<AccountCourtWrite>> ListOfMembersAsync(IReadOnlyCollection<Guid> members, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(members);
        if (members.Count == 0)
        {
            return [];
        }

        return await database.CourtWriters.AsNoTracking()
            .Where(writer => members.Contains(writer.MemberId))
            .Join(database.CourtSessions, writer => writer.CourtSessionId, session => session.Id, (writer, session) => new { Writer = writer, session.RoundId })
            .OrderBy(found => found.Writer.StartedAt).ThenBy(found => found.Writer.CourtSessionId).ThenBy(found => found.Writer.Batch)
            .Select(found => new AccountCourtWrite(found.Writer.CourtSessionId, found.RoundId, found.Writer.Batch, found.Writer.DeviceId, found.Writer.StartedAt))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>The lowercase 8-4-4-4-12 form the parser accepts, so stored ids compare with received ones by text.</summary>
    private static string Text(Guid id) => id.ToString("D");
}
