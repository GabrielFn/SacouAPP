using Microsoft.EntityFrameworkCore;

namespace Sacou.Modules.Matches.Infrastructure;

/// <summary>The Matches tables, in the <c>matches</c> schema. One context per module (ADR 0037).</summary>
internal sealed class MatchesDbContext(DbContextOptions<MatchesDbContext> options) : DbContext(options)
{
    public const string Schema = "matches";
    public const string MigrationsHistoryTable = "__ef_migrations_history";

    public DbSet<CourtSessionRow> CourtSessions => Set<CourtSessionRow>();

    public DbSet<CourtWriterRow> CourtWriters => Set<CourtWriterRow>();

    public DbSet<CourtEventRow> CourtEvents => Set<CourtEventRow>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
        modelBuilder.ApplyConfiguration(new CourtSessionConfiguration());
        modelBuilder.ApplyConfiguration(new CourtWriterConfiguration());
        modelBuilder.ApplyConfiguration(new CourtEventConfiguration());
    }
}
