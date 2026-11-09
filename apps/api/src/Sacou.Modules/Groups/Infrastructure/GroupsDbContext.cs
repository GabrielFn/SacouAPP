using Microsoft.EntityFrameworkCore;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>The Groups tables, in the <c>groups</c> schema. One context per module (ADR 0037).</summary>
internal sealed class GroupsDbContext(DbContextOptions<GroupsDbContext> options) : DbContext(options)
{
    public const string Schema = "groups";
    public const string MigrationsHistoryTable = "__ef_migrations_history";

    public DbSet<GroupRow> Groups => Set<GroupRow>();

    public DbSet<MemberRow> Members => Set<MemberRow>();

    public DbSet<InviteRow> Invites => Set<InviteRow>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
        modelBuilder.ApplyConfiguration(new GroupConfiguration());
        modelBuilder.ApplyConfiguration(new MemberConfiguration());
        modelBuilder.ApplyConfiguration(new InviteConfiguration());
    }
}
