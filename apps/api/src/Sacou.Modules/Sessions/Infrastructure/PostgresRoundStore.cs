using System.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Domain.Series;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Infrastructure;

/// <summary>
/// Reads with <c>AsNoTracking</c> and never lock (light CQRS). SQL is always parameterized: EF turns the
/// interpolated values into parameters (ADR 0037). The one lock is the round's row (ADR 0043, D5).
/// </summary>
internal sealed partial class PostgresRoundStore(SessionsDbContext database) : IRoundStore
{
    public async Task<Round?> FindAsync(GroupId group, RoundId round, CancellationToken cancellationToken)
    {
        var row = await database.Rounds.AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.GroupId == group.Value && candidate.Id == round.Value, cancellationToken)
            .ConfigureAwait(false);
        return await WithAttendancesAsync(row, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>The round of a row read without a lock, with its attendances; null for no row.</summary>
    private async Task<Round?> WithAttendancesAsync(RoundRow? row, CancellationToken cancellationToken)
    {
        if (row is null)
        {
            return null;
        }

        var attendances = await AttendancesOfAsync([row.Id], cancellationToken).ConfigureAwait(false);
        return RowMapping.ToRound(row, attendances[row.Id]);
    }

    public async Task<IReadOnlyList<Round>> ListFromAsync(GroupId group, DateTimeOffset from, CancellationToken cancellationToken)
    {
        var rows = await database.Rounds.AsNoTracking()
            .Where(round => round.GroupId == group.Value && round.StartsAt >= from)
            .OrderBy(round => round.StartsAt).ThenBy(round => round.Id)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var attendances = await AttendancesOfAsync([.. rows.Select(row => row.Id)], cancellationToken).ConfigureAwait(false);
        return [.. rows.Select(row => RowMapping.ToRound(row, attendances[row.Id]))];
    }

    public async Task<Result<RoundChange>> ExecuteInRoundLockAsync(
        GroupId group, RoundId round, Func<Round, Task<Result<RoundChange>>> change, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(change);
        // EF opens no transaction for raw SQL by itself: without this one, FOR UPDATE would lock nothing.
        var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            var changed = await ChangeUnderLockAsync(group, round, change, cancellationToken).ConfigureAwait(false);
            if (changed.IsSuccess)
            {
                await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            }

            return changed;
        }
    }

    /// <summary>Inside the caller's transaction: lock, load, change, and write what the change returned.</summary>
    private async Task<Result<RoundChange>> ChangeUnderLockAsync(
        GroupId group, RoundId round, Func<Round, Task<Result<RoundChange>>> change, CancellationToken cancellationToken)
    {
        var loaded = await LockAndLoadAsync(group, round, cancellationToken).ConfigureAwait(false);
        if (loaded is null)
        {
            return Result.Failure<RoundChange>(RoundErrors.RoundNotFound);
        }

        var changed = await change(loaded.Value.Round).ConfigureAwait(false);
        if (changed.IsFailure || changed.Value.IsEmpty)
        {
            return changed;
        }

        Write(loaded.Value.Round, loaded.Value.CreatedAt, changed.Value);
        try
        {
            await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (DbUpdateException exception) when (IsSeriesDateTaken(exception))
        {
            // An edit moved this round to a date its series already has a round on: the transaction is not committed.
            return Result.Failure<RoundChange>(RoundErrors.RoundDateTaken);
        }

        return changed;
    }

    private static bool IsSeriesDateTaken(DbUpdateException exception) => exception.InnerException is PostgresException
    {
        SqlState: PostgresErrorCodes.UniqueViolation,
        ConstraintName: RoundConfiguration.SeriesDateIndex,
    };

    /// <summary>Each attendance and the round are written whole, as read under the lock: nothing outside the lock may write them.</summary>
    private void Write(Round before, DateTimeOffset createdAt, RoundChange change)
    {
        foreach (var attendance in change.ChangedAttendances)
        {
            var row = RowMapping.ToRow(before.Id, attendance);
            _ = before.AttendanceOf(attendance.Member) is null ? database.Attendances.Add(row) : database.Attendances.Update(row);
        }

        if (change.RoundRowChanged || change.Round.NextSequence != before.NextSequence)
        {
            database.Rounds.Update(RowMapping.ToRow(change.Round, createdAt));
        }
    }

    private async Task<(Round Round, DateTimeOffset CreatedAt)?> LockAndLoadAsync(
        GroupId group, RoundId round, CancellationToken cancellationToken)
    {
        var locked = await database.Database
            .SqlQuery<Guid>($"SELECT id AS \"Value\" FROM sessions.rounds WHERE id = {round.Value} AND group_id = {group.Value} FOR UPDATE")
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        if (locked.Count == 0)
        {
            return null;
        }

        var row = await database.Rounds.AsNoTracking().SingleAsync(candidate => candidate.Id == round.Value, cancellationToken).ConfigureAwait(false);
        var attendances = await AttendancesOfAsync([row.Id], cancellationToken).ConfigureAwait(false);
        return (RowMapping.ToRound(row, attendances[row.Id]), row.CreatedAt);
    }

    private async Task<Dictionary<Guid, List<AttendanceRow>>> AttendancesOfAsync(
        IReadOnlyCollection<Guid> rounds, CancellationToken cancellationToken)
    {
        var rows = await database.Attendances.AsNoTracking()
            .Where(attendance => rounds.Contains(attendance.RoundId))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var byRound = rounds.ToDictionary(round => round, _ => new List<AttendanceRow>());
        foreach (var row in rows)
        {
            byRound[row.RoundId].Add(row);
        }

        return byRound;
    }

    public async Task<IReadOnlyList<RoundSeries>> ListActiveSeriesAsync(GroupId group, CancellationToken cancellationToken)
    {
        var rows = await database.Series.AsNoTracking()
            .Where(series => series.GroupId == group.Value && series.StoppedAt == null)
            .OrderBy(series => series.CreatedAt).ThenBy(series => series.Id)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return [.. rows.Select(RowMapping.ToSeries)];
    }

    public async Task<IReadOnlyDictionary<SeriesId, IReadOnlyList<SeriesOccurrence>>> ListOccurrencesAsync(
        IReadOnlyCollection<SeriesId> series, DateOnly since, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(series);
        var ids = series.Select(id => id.Value).ToList();
        var rows = await database.Rounds.AsNoTracking()
            .Where(round => round.SeriesId != null && ids.Contains(round.SeriesId.Value) && round.LocalDate >= since)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return series.ToDictionary(
            id => id,
            id => (IReadOnlyList<SeriesOccurrence>)RowMapping.ToOccurrences(rows.Where(row => row.SeriesId == id.Value)));
    }
}
