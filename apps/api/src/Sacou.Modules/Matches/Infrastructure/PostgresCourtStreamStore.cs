using System.Collections.Immutable;
using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;

namespace Sacou.Modules.Matches.Infrastructure;

/// <summary>
/// The one lock is the stream's row (ADR 0060, D6). SQL is always parameterized: EF turns the interpolated
/// values into parameters (ADR 0037). Reads outside the lock use <c>AsNoTracking</c>. The envelopes of a stream are
/// replayed once into its snapshot, outside the lock (ADR 0081); under the lock a write reads only those after it, and
/// never the whole stream: with no snapshot it can advance, the write is a 503 and the next try builds one outside.
/// </summary>
internal sealed partial class PostgresCourtStreamStore(
    MatchesDbContext database,
    ICourtStreamSnapshots snapshots,
    ICourtSnapshotSource snapshotReader,
    IOptions<CourtStreamCacheOptions> cacheOptions,
    IOptions<CourtTransactionOptions> transactionOptions) : ICourtStreamStore, ICourtWriterReader
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
        var warm = await WarmAsync(append, cancellationToken).ConfigureAwait(false);
        if (warm?.Warmth == SnapshotWarmth.Busy)
        {
            return CourtStreamOutcome<CourtWriteDecision>.Refused(CourtStreamRefusal.Busy);
        }

        var started = Stopwatch.GetTimestamp();
        LockedAppend locked;
        var committed = false;
        try
        {
            var transaction = await BeginBoundedTransactionAsync(cancellationToken).ConfigureAwait(false);
            await using (transaction.ConfigureAwait(false))
            {
                locked = await AppendUnderLockAsync(append, rules, warm, cancellationToken).ConfigureAwait(false);
                if (locked.Outcome.Decided is { IsSuccess: true } decided && !decided.Value.NewEvents.IsEmpty)
                {
                    await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
                    committed = true;
                }
            }
        }
        catch (Exception exception) when (IsTimeout(exception))
        {
            return CourtStreamOutcome<CourtWriteDecision>.Refused(CourtStreamRefusal.Busy);
        }

        var lockedMs = (long)Stopwatch.GetElapsedTime(started).TotalMilliseconds;
        Keep(append.CourtSessionId, locked, committed);
        var use = warm?.Warmth == SnapshotWarmth.Built ? SnapshotUse.Built : locked.Use;
        return locked.Outcome with { Trace = new CourtAppendTrace(lockedMs, use is { } found ? Word(found) : CourtAppendTrace.NoSnapshot) };
    }

    /// <summary>
    /// Only after the commit does the snapshot with the new events go in: a rollback, an exception or a refusal keeps
    /// only what the lock read, all of it committed. A write that replayed the whole stream, or a snapshot that does
    /// not end at the stored count, drops the copy.
    /// </summary>
    private void Keep(Guid courtSessionId, LockedAppend locked, bool committed)
    {
        if (!locked.Consistent)
        {
            snapshots.Evict(courtSessionId);
            return;
        }

        if (committed)
        {
            if (locked.Outcome.Decided!.Value.Snapshot is { } next)
            {
                snapshots.Publish(courtSessionId, next);
            }
            else
            {
                snapshots.Evict(courtSessionId);
            }

            return;
        }

        if (locked.Read is { Use: SnapshotUse.Advanced } read)
        {
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
    /// built or advanced here, so nobody else makes the server replay a stream (ADR 0081). The lock asks it all again,
    /// on the snapshot handed over here; null for anybody else.
    /// </summary>
    private async Task<WarmSnapshot?> WarmAsync(CourtAppend append, CancellationToken cancellationToken)
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

    private async Task<LockedAppend> AppendUnderLockAsync(
        CourtAppend append, CourtAppendRules rules, WarmSnapshot? warm, CancellationToken cancellationToken)
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
            return await DecideAsync(append, session, rules.Decide(StoredStream.New), LockedRead.None, cancellationToken).ConfigureAwait(false);
        }

        var writers = await LoadWritersAsync(session, cancellationToken).ConfigureAwait(false);
        var history = CourtWriterHistory.Of(writers);
        if (!history.IsCurrentWriter(append.DeviceId, append.CallerMemberId))
        {
            var lastSequence = await LastSequenceAsync(session.Id, append.DeviceId, cancellationToken).ConfigureAwait(false);
            if (rules.RefuseWriter(new WrittenStream(history, session.EventCount, append.DeviceId, lastSequence)) is { } refusal)
            {
                return new LockedAppend(CourtStreamOutcome<CourtWriteDecision>.From(Result<CourtWriteDecision, CourtWriteError>.Failure(refusal)), LockedRead.None);
            }
        }

        var read = await CatchUpAsync(session, warm, cancellationToken).ConfigureAwait(false);
        if (read.Snapshot is not { } caughtUp)
        {
            return new LockedAppend(CourtStreamOutcome<CourtWriteDecision>.Refused(CourtStreamRefusal.Busy), read);
        }

        var decided = rules.Decide(StoredStream.Of(caughtUp.Snapshot, writers));
        return await DecideAsync(append, session, decided, read, cancellationToken).ConfigureAwait(false);
    }

    private async Task<LockedAppend> DecideAsync(
        CourtAppend append, CourtSessionRow session, Result<CourtWriteDecision, CourtWriteError> decided, LockedRead read, CancellationToken cancellationToken)
    {
        if (decided.IsSuccess && !decided.Value.NewEvents.IsEmpty)
        {
            await WriteAsync(append, session, decided.Value, cancellationToken).ConfigureAwait(false);
        }

        return new LockedAppend(CourtStreamOutcome<CourtWriteDecision>.From(decided), read);
    }

    /// <summary>
    /// The snapshot the warm-up handed over, brought up to the stored stream by the events after it, never the whole
    /// stream under the lock (condition 1 of the review of Part 1). None when there is no such snapshot (the caller
    /// became the writer after the warm-up), when it is ahead of the count (changed outside the API, dropped), when
    /// more than a small build lies after it, or when its last event is not there any more (dropped): the write is a
    /// 503 and its next try builds outside the lock. One built by this very warm-up is checked by position only: it is
    /// what the database held a moment ago. One that does not end at the count is used but not kept.
    /// </summary>
    private async Task<LockedRead> CatchUpAsync(CourtSessionRow session, WarmSnapshot? warm, CancellationToken cancellationToken)
    {
        if (warm?.Snapshot is not { } warmed)
        {
            return LockedRead.None;
        }

        if (warmed.Version > session.EventCount)
        {
            return LockedRead.Dropped;
        }

        if (session.EventCount - warmed.Version > cacheOptions.Value.SmallStreamEvents)
        {
            return LockedRead.None;
        }

        var read = await snapshotReader.AdvanceAsync(session.Id, warmed, checkLastEvent: warm.Warmth != SnapshotWarmth.Built, cancellationToken)
            .ConfigureAwait(false);
        return read is null ? LockedRead.Dropped : new LockedRead(read, Consistent: read.Snapshot.Version == session.EventCount);
    }

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

    /// <summary>The lowercase 8-4-4-4-12 form the parser accepts, so stored ids compare with received ones by text.</summary>
    private static string Text(Guid id) => id.ToString("D");

    /// <summary>
    /// The snapshot the lock read, if any, and whether it may be kept: false drops the copy of the cache (it does not
    /// match the stored stream).
    /// </summary>
    private sealed record LockedRead(ReadSnapshot? Snapshot, bool Consistent)
    {
        public static readonly LockedRead None = new(Snapshot: null, Consistent: true);

        public static readonly LockedRead Dropped = new(Snapshot: null, Consistent: false);
    }

    /// <summary>What happened under the lock, and the snapshot it read; its use null when it read none.</summary>
    private sealed record LockedAppend(CourtStreamOutcome<CourtWriteDecision> Outcome, LockedRead LockRead)
    {
        public ReadSnapshot? Read => LockRead.Snapshot;

        public SnapshotUse? Use => Read?.Use;

        public bool Consistent => LockRead.Consistent;

        public static LockedAppend Refused(CourtStreamRefusal refusal) => new(CourtStreamOutcome<CourtWriteDecision>.Refused(refusal), LockedRead.None);
    }
}
