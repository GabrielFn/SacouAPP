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

    public DbSet<GroupSettingsRow> GroupSettings => Set<GroupSettingsRow>();

    public DbSet<SavedTemplateRow> SavedTemplates => Set<SavedTemplateRow>();

    public DbSet<MemberLevelRow> MemberLevels => Set<MemberLevelRow>();

    public DbSet<GuestRow> Guests => Set<GuestRow>();

    public DbSet<ContentReportRow> ContentReports => Set<ContentReportRow>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
        modelBuilder.ApplyConfiguration(new GroupConfiguration());
        modelBuilder.ApplyConfiguration(new MemberConfiguration());
        modelBuilder.ApplyConfiguration(new InviteConfiguration());
        modelBuilder.ApplyConfiguration(new GroupSettingsConfiguration());
        modelBuilder.ApplyConfiguration(new SavedTemplateConfiguration());
        modelBuilder.ApplyConfiguration(new MemberLevelConfiguration());
        modelBuilder.ApplyConfiguration(new GuestConfiguration());
        modelBuilder.ApplyConfiguration(new ContentReportConfiguration());
    }
}
