using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;

namespace Sacou.Modules.Matches.Infrastructure;

/// <summary>The takeover of a stream under its lock (ADR 0063), reading no envelope (ADR 0081).</summary>
internal sealed partial class PostgresCourtStreamStore
{
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
        try
        {
            // EF opens no transaction for raw SQL by itself: without this one, FOR UPDATE would lock nothing.
            var transaction = await BeginBoundedTransactionAsync(cancellationToken).ConfigureAwait(false);
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
        catch (Exception exception) when (IsTimeout(exception))
        {
            return CourtStreamOutcome<CourtTakeoverDecision>.Refused(CourtStreamRefusal.Busy);
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
}
