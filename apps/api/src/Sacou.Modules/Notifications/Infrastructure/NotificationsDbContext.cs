using Microsoft.EntityFrameworkCore;

namespace Sacou.Modules.Notifications.Infrastructure;

/// <summary>The Notifications tables, in the <c>notifications</c> schema. One context per module (ADR 0037).</summary>
internal sealed class NotificationsDbContext(DbContextOptions<NotificationsDbContext> options) : DbContext(options)
{
    public const string Schema = "notifications";
    public const string MigrationsHistoryTable = "__ef_migrations_history";

    public DbSet<NotificationRow> Notifications => Set<NotificationRow>();

    public DbSet<PushDeviceRow> PushDevices => Set<PushDeviceRow>();

    public DbSet<PushDeliveryRow> PushDeliveries => Set<PushDeliveryRow>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
        modelBuilder.ApplyConfiguration(new NotificationConfiguration());
        modelBuilder.ApplyConfiguration(new PushDeviceConfiguration());
        modelBuilder.ApplyConfiguration(new PushDeliveryConfiguration());
    }
}
