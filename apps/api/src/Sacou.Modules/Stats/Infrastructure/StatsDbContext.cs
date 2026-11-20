using Microsoft.EntityFrameworkCore;

namespace Sacou.Modules.Stats.Infrastructure;

/// <summary>The Stats tables, in the <c>stats</c> schema. One context per module (ADR 0037).</summary>
internal sealed class StatsDbContext(DbContextOptions<StatsDbContext> options) : DbContext(options)
{
    public const string Schema = "stats";
    public const string MigrationsHistoryTable = "__ef_migrations_history";

    public DbSet<RoundProjectionRow> RoundProjections => Set<RoundProjectionRow>();

    public DbSet<RoundMemberStatsRow> RoundMemberStats => Set<RoundMemberStatsRow>();

    public DbSet<RatingPoolRow> RatingPools => Set<RatingPoolRow>();

    public DbSet<MemberRatingRow> MemberRatings => Set<MemberRatingRow>();

    public DbSet<MvpVoteRow> MvpVotes => Set<MvpVoteRow>();

    public DbSet<MvpResultRow> MvpResults => Set<MvpResultRow>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
        modelBuilder.ApplyConfiguration(new RoundProjectionConfiguration());
        modelBuilder.ApplyConfiguration(new RoundMemberStatsConfiguration());
        modelBuilder.ApplyConfiguration(new RatingPoolConfiguration());
        modelBuilder.ApplyConfiguration(new MemberRatingConfiguration());
        modelBuilder.ApplyConfiguration(new MvpVoteConfiguration());
        modelBuilder.ApplyConfiguration(new MvpResultConfiguration());
    }
}
