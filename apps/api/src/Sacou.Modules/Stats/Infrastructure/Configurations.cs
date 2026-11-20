using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Sacou.Modules.Stats.Infrastructure;

/// <summary>
/// <c>stats.round_projections</c>, one row per round (one court per round, question 70). No foreign key to a table of
/// another module: the ids are checked by the contracts (ADR 0037).
/// </summary>
internal sealed class RoundProjectionConfiguration : IEntityTypeConfiguration<RoundProjectionRow>
{
    public const string Table = "round_projections";

    public void Configure(EntityTypeBuilder<RoundProjectionRow> builder)
    {
        builder.ToTable(Table, table =>
        {
            table.HasCheckConstraint("ck_round_projections_modality", "modality IN ('indoor-6x6', 'beach-2x2', 'beach-4x4')");
            table.HasCheckConstraint("ck_round_projections_event_count", "event_count >= 0");
            table.HasCheckConstraint("ck_round_projections_finished_matches", "finished_matches >= 0");
        });
        builder.HasKey(row => row.RoundId).HasName("pk_round_projections");
        builder.Property(row => row.RoundId).HasColumnName("round_id").ValueGeneratedNever();
        builder.Property(row => row.GroupId).HasColumnName("group_id");
        builder.Property(row => row.CourtSessionId).HasColumnName("court_session_id");
        builder.Property(row => row.EventCount).HasColumnName("event_count");
        builder.Property(row => row.ProjectionVersion).HasColumnName("projection_version");
        builder.Property(row => row.FactsHash).HasColumnName("facts_hash").HasMaxLength(StatsColumns.HashLength).IsFixedLength();
        builder.Property(row => row.StartsAt).HasColumnName("starts_at").HasColumnType(StatsColumns.Timestamp);
        builder.Property(row => row.LocalDate).HasColumnName("local_date");
        builder.Property(row => row.Counts).HasColumnName("counts");
        builder.Property(row => row.Modality).HasColumnName("modality").HasMaxLength(StatsColumns.CodeLength);
        builder.Property(row => row.FinishedMatches).HasColumnName("finished_matches");
        builder.Property(row => row.Summary).HasColumnName("summary").HasColumnType("jsonb");
        builder.Property(row => row.RebuiltAt).HasColumnName("rebuilt_at").HasColumnType(StatsColumns.Timestamp);

        builder.HasIndex(row => row.GroupId).HasDatabaseName("ix_round_projections_group");
    }
}

/// <summary><c>stats.round_member_stats</c>: by member for the sums of the user (index on <c>member_id</c>), by group for the card.</summary>
internal sealed class RoundMemberStatsConfiguration : IEntityTypeConfiguration<RoundMemberStatsRow>
{
    public const string Table = "round_member_stats";

    public void Configure(EntityTypeBuilder<RoundMemberStatsRow> builder)
    {
        builder.ToTable(Table, table =>
        {
            table.HasCheckConstraint("ck_round_member_stats_counts", "matches_played >= 0 AND wins >= 0 AND losses >= 0 AND undecided >= 0");
            table.HasCheckConstraint("ck_round_member_stats_results", "results ~ '^[wlu]*$' AND length(results) = matches_played");
        });
        builder.HasKey(row => new { row.RoundId, row.MemberId }).HasName("pk_round_member_stats");
        builder.Property(row => row.RoundId).HasColumnName("round_id");
        builder.Property(row => row.MemberId).HasColumnName("member_id");
        builder.Property(row => row.GroupId).HasColumnName("group_id");
        builder.Property(row => row.StartsAt).HasColumnName("starts_at").HasColumnType(StatsColumns.Timestamp);
        builder.Property(row => row.LocalDate).HasColumnName("local_date");
        builder.Property(row => row.MatchesPlayed).HasColumnName("matches_played");
        builder.Property(row => row.Wins).HasColumnName("wins");
        builder.Property(row => row.Losses).HasColumnName("losses");
        builder.Property(row => row.Undecided).HasColumnName("undecided");
        builder.Property(row => row.PlusMinus).HasColumnName("plus_minus");
        builder.Property(row => row.LongestWinStreak).HasColumnName("longest_win_streak");
        builder.Property(row => row.Results).HasColumnName("results");
        builder.Property(row => row.WasMvp).HasColumnName("was_mvp");

        builder.HasOne<RoundProjectionRow>().WithMany().HasForeignKey(row => row.RoundId)
            .HasConstraintName("fk_round_member_stats_round_projections").OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(row => row.MemberId).HasDatabaseName("ix_round_member_stats_member");
        builder.HasIndex(row => row.GroupId).HasDatabaseName("ix_round_member_stats_group");
    }
}

/// <summary><c>stats.rating_pools</c>: one row per pool of a group (<c>indoor</c> or <c>beach</c>, ADR 0071).</summary>
internal sealed class RatingPoolConfiguration : IEntityTypeConfiguration<RatingPoolRow>
{
    public const string Table = "rating_pools";

    public void Configure(EntityTypeBuilder<RatingPoolRow> builder)
    {
        builder.ToTable(Table, table => table.HasCheckConstraint("ck_rating_pools_pool", StatsColumns.PoolCheck));
        builder.HasKey(row => new { row.GroupId, row.Pool }).HasName("pk_rating_pools");
        builder.Property(row => row.GroupId).HasColumnName("group_id");
        builder.Property(row => row.Pool).HasColumnName("pool").HasMaxLength(StatsColumns.CodeLength);
        builder.Property(row => row.InputsHash).HasColumnName("inputs_hash").HasMaxLength(StatsColumns.HashLength).IsFixedLength();
        builder.Property(row => row.ParamsVersion).HasColumnName("params_version");
        builder.Property(row => row.RebuiltAt).HasColumnName("rebuilt_at").HasColumnType(StatsColumns.Timestamp);
    }
}

/// <summary><c>stats.member_ratings</c>: one row per member of a pool of a group, swapped whole with its pool.</summary>
internal sealed class MemberRatingConfiguration : IEntityTypeConfiguration<MemberRatingRow>
{
    public const string Table = "member_ratings";

    public void Configure(EntityTypeBuilder<MemberRatingRow> builder)
    {
        builder.ToTable(Table, table =>
        {
            table.HasCheckConstraint("ck_member_ratings_pool", StatsColumns.PoolCheck);
            table.HasCheckConstraint("ck_member_ratings_seed_source", "seed_source IN ('admin', 'suggested', 'default')");
            table.HasCheckConstraint("ck_member_ratings_seed_tenths", "seed_tenths BETWEEN 10 AND 50");
            table.HasCheckConstraint("ck_member_ratings_matches_rated", "matches_rated >= 0");
        });
        builder.HasKey(row => new { row.GroupId, row.Pool, row.MemberId }).HasName("pk_member_ratings");
        builder.Property(row => row.GroupId).HasColumnName("group_id");
        builder.Property(row => row.Pool).HasColumnName("pool").HasMaxLength(StatsColumns.CodeLength);
        builder.Property(row => row.MemberId).HasColumnName("member_id");
        builder.Property(row => row.Mu).HasColumnName("mu");
        builder.Property(row => row.Sigma).HasColumnName("sigma");
        builder.Property(row => row.SeedTenths).HasColumnName("seed_tenths");
        builder.Property(row => row.SeedSource).HasColumnName("seed_source").HasMaxLength(StatsColumns.CodeLength);
        builder.Property(row => row.MatchesRated).HasColumnName("matches_rated");

        builder.HasOne<RatingPoolRow>().WithMany().HasForeignKey(row => new { row.GroupId, row.Pool })
            .HasConstraintName("fk_member_ratings_rating_pools").OnDelete(DeleteBehavior.Cascade);
    }
}

internal static class StatsColumns
{
    public const string Timestamp = "timestamp with time zone";

    /// <summary>A SHA-256 in hex.</summary>
    public const int HashLength = 64;

    public const int CodeLength = 16;

    public const string PoolCheck = "pool IN ('indoor', 'beach')";
}
