using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sacou.Modules.Notifications.Domain;
using Sacou.Shared.Persistence;

namespace Sacou.Modules.Notifications.Infrastructure;

/// <summary>
/// <c>notifications.notifications</c>. <c>UNIQUE (dedupe_key)</c> is what makes a repeated request or a relay run
/// again after a crash create nothing new (ADR 0069, D3). No foreign key outside the schema (ADR 0040, D6).
/// </summary>
internal sealed class NotificationConfiguration : IEntityTypeConfiguration<NotificationRow>
{
    public const string Table = "notifications";
    public const string DedupeIndex = "ux_notifications_dedupe_key";
    public const int MaxDedupeKeyLength = 200;

    public void Configure(EntityTypeBuilder<NotificationRow> builder)
    {
        builder.ToTable(Table, table =>
        {
            table.HasCheckConstraint("ck_notifications_kind", $"kind IN ({EnumColumns.SqlList(ColumnValues.Kinds)})");
            table.HasCheckConstraint("ck_notifications_dedupe_key", $"char_length(dedupe_key) <= {MaxDedupeKeyLength}");
        });
        builder.HasKey(notification => notification.Id).HasName("pk_notifications");
        builder.Property(notification => notification.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(notification => notification.DedupeKey).HasColumnName("dedupe_key").HasColumnType("text");
        builder.Property(notification => notification.Kind).HasColumnName("kind").HasColumnType("text");
        builder.Property(notification => notification.MemberId).HasColumnName("member_id");
        builder.Property(notification => notification.GroupId).HasColumnName("group_id");
        builder.Property(notification => notification.RoundId).HasColumnName("round_id");
        builder.Property(notification => notification.CreatedAt).HasColumnName("created_at").HasColumnType(Columns.Timestamp);
        builder.Property(notification => notification.ExpiresAt).HasColumnName("expires_at").HasColumnType(Columns.Timestamp);
        builder.Property(notification => notification.ReadAt).HasColumnName("read_at").HasColumnType(Columns.Timestamp);

        builder.HasIndex(notification => notification.DedupeKey).IsUnique().HasDatabaseName(DedupeIndex);
        // Screen 28 reads one person's members, newest first.
        builder.HasIndex(notification => new { notification.MemberId, notification.CreatedAt, notification.Id })
            .HasDatabaseName("ix_notifications_member_created").IsDescending(false, true, true);
    }
}

/// <summary>
/// <c>notifications.push_devices</c> (ADR 0069, D8). A token belongs to one account (<c>UNIQUE (expo_token)</c>), and an
/// installation of the app has one row per account (<c>UNIQUE (user_id, installation_id)</c>).
/// </summary>
internal sealed class PushDeviceConfiguration : IEntityTypeConfiguration<PushDeviceRow>
{
    public const string Table = "push_devices";
    public const string TokenIndex = "ux_push_devices_expo_token";
    public const string InstallationIndex = "ux_push_devices_user_installation";

    public void Configure(EntityTypeBuilder<PushDeviceRow> builder)
    {
        builder.ToTable(Table, table =>
        {
            table.HasCheckConstraint("ck_push_devices_platform", $"platform IN ({EnumColumns.SqlList(ColumnValues.Platforms)})");
            table.HasCheckConstraint("ck_push_devices_token", $"char_length(expo_token) <= {PushToken.MaxLength}");
            table.HasCheckConstraint("ck_push_devices_disabled",
                $"(disabled_at IS NULL) = (disabled_reason IS NULL) AND (disabled_reason IS NULL OR disabled_reason IN ({string.Join(", ", ColumnValues.DisabledReasons.Select(reason => $"'{reason}'"))}))");
        });
        builder.HasKey(device => device.Id).HasName("pk_push_devices");
        builder.Property(device => device.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(device => device.UserId).HasColumnName("user_id");
        builder.Property(device => device.InstallationId).HasColumnName("installation_id");
        builder.Property(device => device.ExpoToken).HasColumnName("expo_token").HasColumnType("text");
        builder.Property(device => device.Platform).HasColumnName("platform").HasColumnType("text");
        builder.Property(device => device.CreatedAt).HasColumnName("created_at").HasColumnType(Columns.Timestamp);
        builder.Property(device => device.LastSeenAt).HasColumnName("last_seen_at").HasColumnType(Columns.Timestamp);
        builder.Property(device => device.DisabledAt).HasColumnName("disabled_at").HasColumnType(Columns.Timestamp);
        builder.Property(device => device.DisabledReason).HasColumnName("disabled_reason").HasColumnType("text");

        builder.HasIndex(device => device.ExpoToken).IsUnique().HasDatabaseName(TokenIndex);
        builder.HasIndex(device => new { device.UserId, device.InstallationId }).IsUnique().HasDatabaseName(InstallationIndex);
    }
}

/// <summary>
/// <c>notifications.push_deliveries</c>: <c>UNIQUE (notification_id, device_id)</c> is one delivery per phone. Both keys
/// cascade, so erasing a device or a notification erases its deliveries (ADR 0069, D9).
/// </summary>
internal sealed class PushDeliveryConfiguration : IEntityTypeConfiguration<PushDeliveryRow>
{
    public const string Table = "push_deliveries";

    public void Configure(EntityTypeBuilder<PushDeliveryRow> builder)
    {
        builder.ToTable(Table, table =>
        {
            table.HasCheckConstraint("ck_push_deliveries_state", $"state IN ({EnumColumns.SqlList(ColumnValues.States)})");
            table.HasCheckConstraint("ck_push_deliveries_attempts", "attempts >= 0");
        });
        builder.HasKey(delivery => delivery.Id).HasName("pk_push_deliveries");
        builder.Property(delivery => delivery.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(delivery => delivery.NotificationId).HasColumnName("notification_id");
        builder.Property(delivery => delivery.DeviceId).HasColumnName("device_id");
        builder.Property(delivery => delivery.State).HasColumnName("state").HasColumnType("text");
        builder.Property(delivery => delivery.Attempts).HasColumnName("attempts");
        builder.Property(delivery => delivery.NextAttemptAt).HasColumnName("next_attempt_at").HasColumnType(Columns.Timestamp);
        builder.Property(delivery => delivery.LeaseUntil).HasColumnName("lease_until").HasColumnType(Columns.Timestamp);
        builder.Property(delivery => delivery.TicketId).HasColumnName("ticket_id").HasColumnType("text");
        builder.Property(delivery => delivery.ErrorCode).HasColumnName("error_code").HasColumnType("text");
        builder.Property(delivery => delivery.CreatedAt).HasColumnName("created_at").HasColumnType(Columns.Timestamp);
        builder.Property(delivery => delivery.UpdatedAt).HasColumnName("updated_at").HasColumnType(Columns.Timestamp);

        builder.HasOne<NotificationRow>().WithMany().HasForeignKey(delivery => delivery.NotificationId)
            .HasConstraintName("fk_push_deliveries_notifications").OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<PushDeviceRow>().WithMany().HasForeignKey(delivery => delivery.DeviceId)
            .HasConstraintName("fk_push_deliveries_push_devices").OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(delivery => new { delivery.NotificationId, delivery.DeviceId }).IsUnique()
            .HasDatabaseName("ux_push_deliveries_notification_device");
        builder.HasIndex(delivery => delivery.DeviceId).HasDatabaseName("ix_push_deliveries_device");
        // The pump looks only at the open ones, by their next turn.
        builder.HasIndex(delivery => new { delivery.State, delivery.NextAttemptAt }).HasDatabaseName("ix_push_deliveries_open")
            .HasFilter($"state IN ('{ColumnValues.States[DeliveryState.Pending]}', '{ColumnValues.States[DeliveryState.Sending]}')");
    }
}

internal static class Columns
{
    public const string Timestamp = "timestamp with time zone";
}
