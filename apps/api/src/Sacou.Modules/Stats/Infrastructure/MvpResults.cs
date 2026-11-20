using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sacou.Modules.Stats.Domain.MvpVoting;
using Sacou.Shared.Members;

namespace Sacou.Modules.Stats.Infrastructure;

/// <summary>
/// A row of <c>stats.mvp_results</c>: the count of a closed vote, frozen at the first read after the window closed
/// (ADR 0072, D12). Only the winners, in the order of the count, and how many voted: never a count per candidate.
/// </summary>
internal sealed class MvpResultRow
{
    public required Guid RoundId { get; init; }

    public required Guid GroupId { get; init; }

    public required IReadOnlyList<Guid> WinnerMemberIds { get; init; }

    public required int Voters { get; init; }

    public required DateTimeOffset TalliedAt { get; init; }

    public override string ToString() => nameof(MvpResultRow);
}

/// <summary>
/// <c>stats.mvp_results</c>: one row per round, written once (<c>ON CONFLICT DO NOTHING</c>), so two first reads at
/// once keep the same count. No foreign key to another module (ADR 0037).
/// </summary>
internal sealed class MvpResultConfiguration : IEntityTypeConfiguration<MvpResultRow>
{
    public const string Table = "mvp_results";

    public void Configure(EntityTypeBuilder<MvpResultRow> builder)
    {
        builder.ToTable(Table, table => table.HasCheckConstraint("ck_mvp_results_voters", "voters >= 0"));
        builder.HasKey(row => row.RoundId).HasName("pk_mvp_results");
        builder.Property(row => row.RoundId).HasColumnName("round_id").ValueGeneratedNever();
        builder.Property(row => row.GroupId).HasColumnName("group_id");
        builder.Property(row => row.WinnerMemberIds).HasColumnName("winner_member_ids").HasColumnType("uuid[]");
        builder.Property(row => row.Voters).HasColumnName("voters");
        builder.Property(row => row.TalliedAt).TimestampColumn("tallied_at");

        builder.HasIndex(row => row.GroupId).HasDatabaseName("ix_mvp_results_group");
    }
}

/// <summary>The frozen counts of the MVP vote. Every read is by group, never by a bare round id.</summary>
internal interface IMvpResultStore
{
    /// <summary>The frozen counts of the group's rounds, by round id.</summary>
    Task<IReadOnlyDictionary<Guid, MvpTallyResult>> ListForGroupAsync(Guid groupId, CancellationToken cancellationToken);

    /// <summary>
    /// Stores <paramref name="result"/> unless the round already has a count, and returns the stored one: the first
    /// freeze wins, a later or racing one never replaces it.
    /// </summary>
    Task<MvpTallyResult> FreezeAsync(Guid groupId, Guid roundId, MvpTallyResult result, DateTimeOffset talliedAt, CancellationToken cancellationToken);
}

/// <summary>SQL is always parameterized: EF turns the interpolated values into parameters (ADR 0037).</summary>
internal sealed class PostgresMvpResultStore(StatsDbContext database) : IMvpResultStore
{
    public async Task<IReadOnlyDictionary<Guid, MvpTallyResult>> ListForGroupAsync(Guid groupId, CancellationToken cancellationToken)
    {
        var rows = await database.MvpResults.AsNoTracking()
            .Where(row => row.GroupId == groupId)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return rows.ToDictionary(row => row.RoundId, ToResult);
    }

    public async Task<MvpTallyResult> FreezeAsync(
        Guid groupId, Guid roundId, MvpTallyResult result, DateTimeOffset talliedAt, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(result);
        var winners = result.Winners.Select(winner => winner.Value).ToArray();
        _ = await database.Database.ExecuteSqlAsync(
            $"""
            INSERT INTO stats.mvp_results (round_id, group_id, winner_member_ids, voters, tallied_at)
            VALUES ({roundId}, {groupId}, {winners}, {result.Voters}, {talliedAt.ToUniversalTime()})
            ON CONFLICT (round_id) DO NOTHING
            """, cancellationToken).ConfigureAwait(false);
        var stored = await database.MvpResults.AsNoTracking()
            .SingleAsync(row => row.GroupId == groupId && row.RoundId == roundId, cancellationToken)
            .ConfigureAwait(false);
        return ToResult(stored);
    }

    private static MvpTallyResult ToResult(MvpResultRow row) =>
        new([.. row.WinnerMemberIds.Select(winner => new MemberId(winner))], row.Voters);
}
