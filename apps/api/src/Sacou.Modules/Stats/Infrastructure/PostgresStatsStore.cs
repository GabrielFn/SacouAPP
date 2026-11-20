using System.Data;
using Microsoft.EntityFrameworkCore;

namespace Sacou.Modules.Stats.Infrastructure;

/// <summary>
/// Where the projections and the hidden ratings live (ADR 0071). A projection is a cache: every write replaces it
/// whole, never adds to it. Reads are always by group, never by a bare id (ADR 0040, D7).
/// </summary>
internal interface IStatsStore
{
    /// <summary>The stored projections of the group, with their keys and summaries; no lock.</summary>
    Task<IReadOnlyList<RoundProjectionRow>> ListProjectionsAsync(Guid groupId, CancellationToken cancellationToken);

    /// <summary>
    /// One transaction: upserts the projection unless the stored one was built from more events (a late rebuild never
    /// overwrites a newer one), then replaces the rows of its members. False when the stored one was newer.
    /// </summary>
    Task<bool> SaveProjectionAsync(RoundProjectionRow projection, IReadOnlyList<RoundMemberStatsRow> members, CancellationToken cancellationToken);

    /// <summary>The pools of the group and the hash of the inputs each was folded from; no lock.</summary>
    Task<IReadOnlyList<RatingPoolRow>> ListPoolsAsync(Guid groupId, CancellationToken cancellationToken);

    /// <summary>
    /// One transaction under the lock of the pool row: unless the stored hash already is <paramref name="pool"/>'s,
    /// replaces every rating of the pool with <paramref name="ratings"/>. Swaps of one pool run one after another.
    /// </summary>
    Task SwapPoolAsync(RatingPoolRow pool, IReadOnlyList<MemberRatingRow> ratings, CancellationToken cancellationToken);
}

/// <summary>SQL is always parameterized: EF turns the interpolated values into parameters (ADR 0037).</summary>
internal sealed class PostgresStatsStore(StatsDbContext database) : IStatsStore
{
    public async Task<IReadOnlyList<RoundProjectionRow>> ListProjectionsAsync(Guid groupId, CancellationToken cancellationToken) =>
        await database.RoundProjections.AsNoTracking()
            .Where(row => row.GroupId == groupId)
            .ToListAsync(cancellationToken).ConfigureAwait(false);

    public async Task<bool> SaveProjectionAsync(
        RoundProjectionRow projection, IReadOnlyList<RoundMemberStatsRow> members, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(projection);
        ArgumentNullException.ThrowIfNull(members);
        var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            // The upsert locks the row first, so the members of one round are replaced one transaction after another.
            var stored = await UpsertAsync(projection, cancellationToken).ConfigureAwait(false);
            if (!stored)
            {
                return false;
            }

            _ = await database.RoundMemberStats
                .Where(row => row.RoundId == projection.RoundId)
                .ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
            database.RoundMemberStats.AddRange(members);
            _ = await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            database.ChangeTracker.Clear();
            return true;
        }
    }

    private async Task<bool> UpsertAsync(RoundProjectionRow row, CancellationToken cancellationToken)
    {
        var written = await database.Database.ExecuteSqlAsync(
            $"""
            INSERT INTO stats.round_projections (round_id, group_id, court_session_id, event_count, projection_version, facts_hash,
                starts_at, local_date, counts, modality, finished_matches, summary, rebuilt_at)
            VALUES ({row.RoundId}, {row.GroupId}, {row.CourtSessionId}, {row.EventCount}, {row.ProjectionVersion}, {row.FactsHash},
                {row.StartsAt}, {row.LocalDate}, {row.Counts}, {row.Modality}, {row.FinishedMatches}, CAST({row.Summary} AS jsonb), {row.RebuiltAt})
            ON CONFLICT (round_id) DO UPDATE SET
                court_session_id = EXCLUDED.court_session_id,
                event_count = EXCLUDED.event_count,
                projection_version = EXCLUDED.projection_version,
                facts_hash = EXCLUDED.facts_hash,
                starts_at = EXCLUDED.starts_at,
                local_date = EXCLUDED.local_date,
                counts = EXCLUDED.counts,
                modality = EXCLUDED.modality,
                finished_matches = EXCLUDED.finished_matches,
                summary = EXCLUDED.summary,
                rebuilt_at = EXCLUDED.rebuilt_at
            WHERE stats.round_projections.group_id = EXCLUDED.group_id
                AND stats.round_projections.event_count <= EXCLUDED.event_count
            """,
            cancellationToken).ConfigureAwait(false);
        return written == 1;
    }

    public async Task<IReadOnlyList<RatingPoolRow>> ListPoolsAsync(Guid groupId, CancellationToken cancellationToken) =>
        await database.RatingPools.AsNoTracking()
            .Where(row => row.GroupId == groupId)
            .ToListAsync(cancellationToken).ConfigureAwait(false);

    public async Task SwapPoolAsync(RatingPoolRow pool, IReadOnlyList<MemberRatingRow> ratings, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(pool);
        ArgumentNullException.ThrowIfNull(ratings);
        var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            if (!await TakePoolAsync(pool, cancellationToken).ConfigureAwait(false))
            {
                return;
            }

            _ = await database.MemberRatings
                .Where(row => row.GroupId == pool.GroupId && row.Pool == pool.Pool)
                .ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
            database.MemberRatings.AddRange(ratings);
            _ = await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            database.ChangeTracker.Clear();
        }
    }

    /// <summary>
    /// Inserts the pool row with the new hash, or locks the existing one and moves it to the new hash. False when the
    /// row already had it: another swap of the same inputs got there first, and the ratings are the same.
    /// </summary>
    private async Task<bool> TakePoolAsync(RatingPoolRow pool, CancellationToken cancellationToken)
    {
        var inserted = await database.Database.ExecuteSqlAsync(
            $"""
            INSERT INTO stats.rating_pools (group_id, pool, inputs_hash, params_version, rebuilt_at)
            VALUES ({pool.GroupId}, {pool.Pool}, {pool.InputsHash}, {pool.ParamsVersion}, {pool.RebuiltAt})
            ON CONFLICT DO NOTHING
            """,
            cancellationToken).ConfigureAwait(false);
        if (inserted == 1)
        {
            return true;
        }

        // Not composed: a LIMIT around it would move FOR UPDATE into a subquery.
        var locked = await database.RatingPools
            .FromSql($"SELECT * FROM stats.rating_pools WHERE group_id = {pool.GroupId} AND pool = {pool.Pool} FOR UPDATE")
            .AsNoTracking()
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        if (locked.Single().InputsHash == pool.InputsHash)
        {
            return false;
        }

        _ = await database.RatingPools
            .Where(row => row.GroupId == pool.GroupId && row.Pool == pool.Pool)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(row => row.InputsHash, pool.InputsHash)
                    .SetProperty(row => row.ParamsVersion, pool.ParamsVersion)
                    .SetProperty(row => row.RebuiltAt, pool.RebuiltAt),
                cancellationToken)
            .ConfigureAwait(false);
        return true;
    }
}
