using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Sessions.Infrastructure.Outbox;

namespace Sacou.Modules.Sessions.Infrastructure;

/// <summary>The Sessions tables, in the <c>sessions</c> schema. One context per module (ADR 0037).</summary>
internal sealed class SessionsDbContext(DbContextOptions<SessionsDbContext> options) : DbContext(options)
{
    public const string Schema = "sessions";
    public const string MigrationsHistoryTable = "__ef_migrations_history";

    public DbSet<SeriesRow> Series => Set<SeriesRow>();

    public DbSet<RoundRow> Rounds => Set<RoundRow>();

    public DbSet<AttendanceRow> Attendances => Set<AttendanceRow>();

    public DbSet<RoundTeamSlotRow> RoundTeams => Set<RoundTeamSlotRow>();

    public DbSet<OutboxMessageRow> OutboxMessages => Set<OutboxMessageRow>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
        modelBuilder.ApplyConfiguration(new SeriesConfiguration());
        modelBuilder.ApplyConfiguration(new RoundConfiguration());
        modelBuilder.ApplyConfiguration(new AttendanceConfiguration());
        modelBuilder.ApplyConfiguration(new RoundTeamSlotConfiguration());
        modelBuilder.ApplyConfiguration(new OutboxMessageConfiguration());
    }
}
