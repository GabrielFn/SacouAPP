using System.Collections.Immutable;
using System.Data;
using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;

namespace Sacou.Modules.Matches.Infrastructure;

/// <summary>
/// The one lock is the stream's row (ADR 0060, D6). SQL is always parameterized: EF turns the interpolated
/// values into parameters (ADR 0037). Reads outside the lock use <c>AsNoTracking</c>. The envelopes of a stream are
/// replayed once into its snapshot, outside the lock (ADR 0081); under the lock a write reads only those after it.
/// </summary>
internal sealed class PostgresCourtStreamStore(
    MatchesDbContext database,
    ICourtStreamSnapshots snapshots,
    CourtSnapshotReader snapshotReader) : ICourtStreamStore, ICourtEventStore, ICourtWriterReader
{
    private const int FirstPosition = 1;
    private const long NoSequence = 0;

    public async Task<CourtStreamOutcome<CourtWriteDecision>> AppendAsync(
        CourtAppend append,
        CourtAppendRules rules,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(append);
        ArgumentNullException.ThrowIfNull(rules);
        var warmth = await WarmAsync(append, cancellationToken).ConfigureAwait(false);
        if (warmth == SnapshotWarmth.Busy)
        {
            return CourtStreamOutcome<CourtWriteDecision>.Refused(CourtStreamRefusal.Busy);
        }

        var started = Stopwatch.GetTimestamp();
        LockedAppend locked;
        var committed = false;
        var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            locked = await AppendUnderLockAsync(append, rules, cancellationToken).ConfigureAwait(false);
            if (locked.Outcome.Decided is { IsSuccess: true } decided && !decided.Value.NewEvents.IsEmpty)
            {
                await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
                committed = true;
            }
        }

        var lockedMs = (long)Stopwatch.GetElapsedTime(started).TotalMilliseconds;
        Keep(append.CourtSessionId, locked, committed);
        var use = warmth == SnapshotWarmth.Built ? SnapshotUse.Built : locked.Use;
        return locked.Outcome with { Trace = new CourtAppendTrace(lockedMs, use is { } found ? Word(found) : CourtAppendTrace.NoSnapshot) };
    }

    /// <summary>
    /// Only after the commit does the snapshot with the new events go in: a rollback, an exception or a refusal keeps
    /// only what the lock read, all of it committed. A write that replayed the whole stream drops the copy.
    /// </summary>
    private void Keep(Guid courtSessionId, LockedAppend locked, bool committed)
    {
        if (committed)
        {
            var next = locked.Outcome.Decided!.Value.Snapshot;
            if (next is null)
            {
                snapshots.Evict(courtSessionId);
                return;
            }

            if (locked.Use == SnapshotUse.Built)
            {
                snapshots.Evict(courtSessionId);
            }

            snapshots.Publish(courtSessionId, next);
            return;
        }

        if (locked.Read is { } read && read.Use != SnapshotUse.Hit)
        {
            if (read.Use == SnapshotUse.Built)
            {
                snapshots.Evict(courtSessionId);
            }

            snapshots.Publish(courtSessionId, read.Snapshot);
        }
    }

    private static string Word(SnapshotUse use) => use switch
    {
        SnapshotUse.Hit => "hit",
        SnapshotUse.Advanced => "advanced",
        SnapshotUse.Built => "built",
        _ => throw new ArgumentOutOfRangeException(nameof(use), use, "Every use has a word."),
    };

    /// <summary>
    /// Outside the lock, a cheap look at the stream: only its current writer, in its group and round, gets the snapshot
    /// built or advanced here, so nobody else makes the server replay a stream (ADR 0081). The lock asks it all again.
    /// </summary>
    private async Task<SnapshotWarmth?> WarmAsync(CourtAppend append, CancellationToken cancellationToken)
    {
        var session = await database.CourtSessions.AsNoTracking()
            .Where(row => row.Id == append.CourtSessionId)
            .Select(row => new { row.GroupId, row.RoundId, row.EventCount })
            .SingleOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (session is null || session.GroupId != append.GroupId || session.RoundId != append.RoundId)
        {
            return null;
        }

        var writer = await database.CourtWriters.AsNoTracking()
            .Where(row => row.CourtSessionId == append.CourtSessionId)
            .OrderByDescending(row => row.Batch)
            .Select(row => new { row.DeviceId, row.MemberId })
            .FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        var writes = writer is not null
            && string.Equals(Text(writer.DeviceId), append.DeviceId, StringComparison.Ordinal)
            && string.Equals(Text(writer.MemberId), append.CallerMemberId, StringComparison.Ordinal);
        return writes
            ? await snapshots.EnsureAsync(append.CourtSessionId, session.EventCount, cancellationToken).ConfigureAwait(false)
            : null;
    }

    private async Task<LockedAppend> AppendUnderLockAsync(CourtAppend append, CourtAppendRules rules, CancellationToken cancellationToken)
    {
        var created = append.MayCreate && await TryCreateAsync(append, cancellationToken).ConfigureAwait(false);
        var session = await LockAsync(append.CourtSessionId, cancellationToken).ConfigureAwait(false);
        if (session is null)
        {
            // Not created: either the round is canceled, or the insert met the other stream of the round.
            return LockedAppend.Refused(append.MayCreate ? CourtStreamRefusal.RoundHasCourtSession : CourtStreamRefusal.RoundCanceled);
        }

        if (!BelongsTo(session, append.GroupId, append.RoundId))
        {
            return LockedAppend.Refused(CourtStreamRefusal.CourtSessionNotFound);
        }

        if (created)
        {
            return await DecideAsync(append, session, rules.Decide(StoredStream.New), read: null, cancellationToken).ConfigureAwait(false);
        }

        var writers = await LoadWritersAsync(session, cancellationToken).ConfigureAwait(false);
        var history = CourtWriterHistory.Of(writers);
        if (!history.IsCurrentWriter(append.DeviceId, append.CallerMemberId))
        {
            var lastSequence = await LastSequenceAsync(session.Id, append.DeviceId, cancellationToken).ConfigureAwait(false);
            if (rules.RefuseWriter(new WrittenStream(history, session.EventCount, append.DeviceId, lastSequence)) is { } refusal)
            {
                return new LockedAppend(CourtStreamOutcome<CourtWriteDecision>.From(Result<CourtWriteDecision, CourtWriteError>.Failure(refusal)), Read: null);
            }
        }

        var read = await CatchUpAsync(session, cancellationToken).ConfigureAwait(false);
        var decided = rules.Decide(StoredStream.Of(read.Snapshot, writers));
        return await DecideAsync(append, session, decided, read, cancellationToken).ConfigureAwait(false);
    }

    private async Task<LockedAppend> DecideAsync(
        CourtAppend append, CourtSessionRow session, Result<CourtWriteDecision, CourtWriteError> decided, ReadSnapshot? read, CancellationToken cancellationToken)
    {
        if (decided.IsSuccess && !decided.Value.NewEvents.IsEmpty)
        {
            await WriteAsync(append, session, decided.Value, cancellationToken).ConfigureAwait(false);
        }

        return new LockedAppend(CourtStreamOutcome<CourtWriteDecision>.From(decided), read);
    }

    /// <summary>
    /// The snapshot kept, unless it is ahead of the count under the lock, brought up to the stored stream. Its version
    /// must be the count: otherwise the counters and the rows disagree, and the write goes on without keeping it.
    /// </summary>
    private async Task<ReadSnapshot> CatchUpAsync(CourtSessionRow session, CancellationToken cancellationToken)
    {
        var kept = snapshots.TryGet(session.Id) is { } snapshot && snapshot.Version <= session.EventCount ? snapshot : null;
        var read = await snapshotReader.ReadAsync(session.Id, kept, cancellationToken).ConfigureAwait(false);
        if (read.Snapshot.Version != session.EventCount)
        {
            snapshots.Evict(session.Id);
        }

        return read;
    }

    /// <summary>
    /// The role is asked again only once the lock is held: a member made a player between the filter and the lock
    /// does not take the court (ADR 0063, D4). A stream of another round or group is the same 404 as none. No
    /// envelope is read: the count is the stream row's and the sequence of the device one indexed query (ADR 0081).
    /// </summary>
    public Task<CourtStreamOutcome<CourtTakeoverDecision>> TakeOverAsync(
        CourtTakeoverCall call,
        Func<IWrittenStream, Result<CourtTakeoverDecision, CourtWriteError>> decide,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(call);
        ArgumentNullException.ThrowIfNull(decide);
        return TakeOverInTransactionAsync(call, decide, cancellationToken);
    }

    private async Task<CourtStreamOutcome<CourtTakeoverDecision>> TakeOverInTransactionAsync(
        CourtTakeoverCall call,
        Func<IWrittenStream, Result<CourtTakeoverDecision, CourtWriteError>> decide,
        CancellationToken cancellationToken)
    {
        // EF opens no transaction for raw SQL by itself: without this one, FOR UPDATE would lock nothing.
        var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            var outcome = await TakeOverUnderLockAsync(call, decide, cancellationToken).ConfigureAwait(false);
            if (outcome.Decided is { IsSuccess: true } decided && decided.Value.OpensBatch)
            {
                await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            }

            return outcome;
        }
    }

    private async Task<CourtStreamOutcome<CourtTakeoverDecision>> TakeOverUnderLockAsync(
        CourtTakeoverCall call,
        Func<IWrittenStream, Result<CourtTakeoverDecision, CourtWriteError>> decide,
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

        var writers = CourtWriterHistory.Of(await LoadWritersAsync(session, cancellationToken).ConfigureAwait(false));
        var lastSequence = await LastSequenceAsync(session.Id, call.DeviceId, cancellationToken).ConfigureAwait(false);
        var decided = decide(new WrittenStream(writers, session.EventCount, call.DeviceId, lastSequence));
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

    /// <summary>The last writer is the one of the current batch, or the stream was changed outside the API: fail closed.</summary>
    private async Task<ImmutableArray<CourtWriter>> LoadWritersAsync(CourtSessionRow session, CancellationToken cancellationToken)
    {
        var writers = await database.CourtWriters.AsNoTracking()
            .Where(row => row.CourtSessionId == session.Id)
            .OrderBy(row => row.Batch)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        if (writers.Count == 0 || writers[^1].Batch != session.CurrentBatch)
        {
            throw new CorruptCourtStreamException(session.Id);
        }

        return [.. writers.Select(row => new CourtWriter(row.Batch, Text(row.DeviceId), Text(row.MemberId), row.EventsBefore))];
    }

    /// <summary>The largest stored sequence of the device, across batches; 0 when it never wrote. A device id that is not a UUID never wrote.</summary>
    private async Task<long> LastSequenceAsync(Guid courtSessionId, string deviceId, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(deviceId, out var device))
        {
            return NoSequence;
        }

        var last = await database.CourtEvents.AsNoTracking()
            .Where(row => row.CourtSessionId == courtSessionId && row.DeviceId == device)
            .MaxAsync(row => (long?)row.Sequence, cancellationToken).ConfigureAwait(false);
        return last ?? NoSequence;
    }

    public async Task<ImmutableArray<StreamEvent>> LoadAsync(Guid courtSessionId, CancellationToken cancellationToken)
    {
        var envelopes = await database.CourtEvents.AsNoTracking()
            .Where(row => row.CourtSessionId == courtSessionId)
            .OrderBy(row => row.Position)
            .Select(row => row.Envelope)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return [.. envelopes.Select(envelope => CourtSnapshotReader.Parse(courtSessionId, envelope))];
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

    /// <summary>What happened under the lock, and the snapshot it read, if any; its use null when it read none.</summary>
    private sealed record LockedAppend(CourtStreamOutcome<CourtWriteDecision> Outcome, ReadSnapshot? Read)
    {
        public SnapshotUse? Use => Read?.Use;

        public static LockedAppend Refused(CourtStreamRefusal refusal) => new(CourtStreamOutcome<CourtWriteDecision>.Refused(refusal), Read: null);
    }
}
