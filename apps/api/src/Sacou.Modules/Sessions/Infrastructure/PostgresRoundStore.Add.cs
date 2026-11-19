using System.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Sacou.Modules.Sessions.Domain;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Infrastructure;

/// <summary>Inserting rounds and series, and the group-wide ceilings (ADR 0043, D3 and D10).</summary>
internal sealed partial class PostgresRoundStore
{
    /// <summary>First key of the two-key advisory lock: "rounds of one group are being created", apart from the Groups families.</summary>
    private const int RoundCreationLockFamily = 4_301;

    public async Task<Result<bool>> AddAsync(NewRound added, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(added);
        var round = added.Change.Round;
        var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            if (added.EnforceLimits && await RefusalAsync(round.GroupId, added, cancellationToken).ConfigureAwait(false) is { } refusal)
            {
                return Result.Failure<bool>(refusal);
            }

            if (added.NewSeries is { } series)
            {
                database.Series.Add(RowMapping.ToRow(series, added.Now));
                await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            }

            bool inserted;
            try
            {
                inserted = await InsertIfAbsentAsync(RowMapping.ToRow(round, added.Now), cancellationToken).ConfigureAwait(false);
            }
            catch (PostgresException exception) when (IsLinkCodeTaken(exception))
            {
                // Another round has the same link code: nothing is committed, and the caller tries again with a new one.
                return Result.Failure<bool>(RoundLinkCodeErrors.Taken);
            }

            if (inserted)
            {
                database.Attendances.AddRange(added.Change.ChangedAttendances.Select(attendance => RowMapping.ToRow(round.Id, attendance)));
                await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            }

            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            return Result.Success(inserted);
        }
    }

    public async Task<Result> StopSeriesAsync(GroupId group, SeriesId series, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var row = await database.Series.AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.GroupId == group.Value && candidate.Id == series.Value, cancellationToken)
            .ConfigureAwait(false);
        if (row is null)
        {
            return Result.Failure(RoundErrors.SeriesNotFound);
        }

        // Only while still active: two stops together leave the first stop time.
        var stoppedAt = RowMapping.ToSeries(row).Stop(now).StoppedAt;
        _ = await database.Series
            .Where(candidate => candidate.Id == series.Value && candidate.GroupId == group.Value && candidate.StoppedAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(candidate => candidate.StoppedAt, stoppedAt), cancellationToken)
            .ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>The ceilings of D10, counted under the group's lock so two creations together cannot both pass.</summary>
    private async Task<Error?> RefusalAsync(GroupId group, NewRound added, CancellationToken cancellationToken)
    {
        _ = await database.Database.ExecuteSqlAsync(
            $"SELECT pg_advisory_xact_lock({RoundCreationLockFamily}, hashtext({group.Value.ToString()}))", cancellationToken).ConfigureAwait(false);
        var canceled = ColumnValues.Canceled;
        var upcoming = await database.Rounds
            .CountAsync(round => round.GroupId == group.Value && round.StartsAt > added.Now && round.Status != canceled, cancellationToken)
            .ConfigureAwait(false);
        if (upcoming >= SessionLimits.MaxUpcomingRoundsPerGroup)
        {
            return RoundErrors.RoundLimit;
        }

        if (added.NewSeries is null)
        {
            return null;
        }

        var active = await database.Series.CountAsync(series => series.GroupId == group.Value && series.StoppedAt == null, cancellationToken)
            .ConfigureAwait(false);
        return active >= SessionLimits.MaxActiveSeriesPerGroup ? RoundErrors.SeriesLimit : null;
    }

    /// <summary>
    /// The unique index on <c>(series_id, local_date)</c> decides who made the occurrence: a second insert of the
    /// same date waits for the first to commit and then does nothing, so the mensalistas are seeded once.
    /// </summary>
    private async Task<bool> InsertIfAbsentAsync(RoundRow row, CancellationToken cancellationToken)
    {
        var inserted = await database.Database.SqlQuery<Guid>(
            $"""
            INSERT INTO sessions.rounds
                (id, group_id, series_id, local_date, local_time, time_zone, starts_at, venue, settings_layer, status, next_sequence, created_at,
                 link_code)
            VALUES
                ({row.Id}, {row.GroupId}, CAST({row.SeriesId} AS uuid), {row.LocalDate}, {row.LocalTime}, {row.TimeZone}, {row.StartsAt},
                 {row.Venue}, CAST({row.SettingsLayer} AS jsonb), {row.Status}, {row.NextSequence}, {row.CreatedAt},
                 CAST({row.LinkCode} AS text))
            ON CONFLICT (series_id, local_date) DO NOTHING
            RETURNING id AS "Value"
            """).ToListAsync(cancellationToken).ConfigureAwait(false);
        return inserted.Count > 0;
    }
}
