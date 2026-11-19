using Microsoft.EntityFrameworkCore;
using Sacou.Shared.Persistence;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sacou.Modules.Sessions.Domain;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Domain.Time;

namespace Sacou.Modules.Sessions.Infrastructure;

/// <summary>
/// <c>sessions.round_series</c>: the weekly recurrence. No foreign key to the Groups tables: a module never
/// ties itself to another module's table (ADR 0040, D6).
/// </summary>
internal sealed class SeriesConfiguration : IEntityTypeConfiguration<SeriesRow>
{
    public const string Table = "round_series";

    private const string TimestampType = "timestamp with time zone";
    private const int FirstIsoWeekday = 1;
    private const int LastIsoWeekday = 7;

    public static string TimeZoneRule => $"time_zone IN ('{SessionsTime.TimeZoneId}')";

    public static string VenueRule => $"char_length(venue) <= {SessionLimits.MaxVenueCodePoints}";

    public void Configure(EntityTypeBuilder<SeriesRow> builder)
    {
        builder.ToTable(Table, table =>
        {
            table.HasCheckConstraint("ck_round_series_weekday", $"weekday BETWEEN {FirstIsoWeekday} AND {LastIsoWeekday}");
            table.HasCheckConstraint("ck_round_series_time_zone", TimeZoneRule);
            table.HasCheckConstraint("ck_round_series_venue", VenueRule);
        });
        builder.HasKey(series => series.Id).HasName("pk_round_series");
        builder.Property(series => series.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(series => series.GroupId).HasColumnName("group_id");
        builder.Property(series => series.Weekday).HasColumnName("weekday");
        builder.Property(series => series.LocalTime).HasColumnName("local_time").HasColumnType("time without time zone");
        builder.Property(series => series.Venue).HasColumnName("venue").HasColumnType("text");
        builder.Property(series => series.TimeZone).HasColumnName("time_zone").HasColumnType("text");
        builder.Property(series => series.CreatedAt).HasColumnName("created_at").HasColumnType(TimestampType);
        builder.Property(series => series.StoppedAt).HasColumnName("stopped_at").HasColumnType(TimestampType);

        builder.HasIndex(series => series.GroupId).HasDatabaseName("ix_round_series_group_id");
    }
}

/// <summary>
/// <c>sessions.rounds</c>. The unique index on <c>(series_id, local_date)</c> is what makes materializing a
/// series on read idempotent: the second insert of the same date does nothing (ADR 0043, D3).
/// </summary>
internal sealed class RoundConfiguration : IEntityTypeConfiguration<RoundRow>
{
    public const string Table = "rounds";
    public const string SeriesDateIndex = "ux_rounds_series_date";
    public const string LinkCodeIndex = "ux_rounds_link_code";

    private const string TimestampType = "timestamp with time zone";

    public void Configure(EntityTypeBuilder<RoundRow> builder)
    {
        builder.ToTable(Table, table =>
        {
            table.HasCheckConstraint("ck_rounds_status", $"status IN ({EnumColumns.SqlList(ColumnValues.RoundStatuses)})");
            table.HasCheckConstraint("ck_rounds_time_zone", SeriesConfiguration.TimeZoneRule);
            table.HasCheckConstraint("ck_rounds_venue", SeriesConfiguration.VenueRule);
            table.HasCheckConstraint("ck_rounds_next_sequence", "next_sequence >= 1");
            table.HasCheckConstraint(
                "ck_rounds_settings_layer",
                $"settings_layer IS NULL OR (jsonb_typeof(settings_layer) = 'object' AND octet_length(settings_layer::text) <= {SessionLimits.MaxSettingsLayerBytes})");
            table.HasCheckConstraint("ck_rounds_link_code", $"link_code ~ '^[A-Za-z0-9_-]{{{RoundLinkCode.Length}}}$'");
        });
        builder.HasKey(round => round.Id).HasName("pk_rounds");
        builder.Property(round => round.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(round => round.GroupId).HasColumnName("group_id");
        builder.Property(round => round.SeriesId).HasColumnName("series_id");
        builder.Property(round => round.LocalDate).HasColumnName("local_date").HasColumnType("date");
        builder.Property(round => round.LocalTime).HasColumnName("local_time").HasColumnType("time without time zone");
        builder.Property(round => round.TimeZone).HasColumnName("time_zone").HasColumnType("text");
        builder.Property(round => round.StartsAt).HasColumnName("starts_at").HasColumnType(TimestampType);
        builder.Property(round => round.Venue).HasColumnName("venue").HasColumnType("text");
        builder.Property(round => round.SettingsLayer).HasColumnName("settings_layer").HasColumnType("jsonb");
        builder.Property(round => round.Status).HasColumnName("status").HasColumnType("text");
        builder.Property(round => round.NextSequence).HasColumnName("next_sequence");
        builder.Property(round => round.CreatedAt).HasColumnName("created_at").HasColumnType(TimestampType);
        builder.Property(round => round.LinkCode).HasColumnName("link_code").HasColumnType($"character({RoundLinkCode.Length})");

        builder.HasOne<SeriesRow>().WithMany().HasForeignKey(round => round.SeriesId)
            .HasConstraintName("fk_rounds_round_series").OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(round => new { round.SeriesId, round.LocalDate }).IsUnique().HasDatabaseName(SeriesDateIndex);
        builder.HasIndex(round => new { round.GroupId, round.StartsAt }).HasDatabaseName("ix_rounds_group_starts_at");
        // The page and the link routes find the round by its code alone (ADR 0070, D1).
        builder.HasIndex(round => round.LinkCode).IsUnique().HasDatabaseName(LinkCodeIndex).HasFilter("link_code IS NOT NULL");
    }
}

/// <summary>
/// <c>sessions.attendances</c>: one row per member per round (the primary key turns a double tap into one row).
/// <c>(round_id, sequence)</c> is unique among the rows that are in the order (going, waitlisted, promoted): the order is a
/// number the lock hands out, never the clock. A "não vou" with no earlier row is not in the order and spends no number.
/// </summary>
internal sealed class AttendanceConfiguration : IEntityTypeConfiguration<AttendanceRow>
{
    public const string Table = "attendances";
    public const string SequenceIndex = "ux_attendances_round_sequence";
    public const string MemberIndex = "ix_attendances_member";

    private const string TimestampType = "timestamp with time zone";

    public void Configure(EntityTypeBuilder<AttendanceRow> builder)
    {
        builder.ToTable(Table, table =>
        {
            table.HasCheckConstraint("ck_attendances_status", $"status IN ({EnumColumns.SqlList(ColumnValues.AttendanceStatuses)})");
            table.HasCheckConstraint("ck_attendances_source", $"source IN ({EnumColumns.SqlList(ColumnValues.AttendanceSources)})");
            table.HasCheckConstraint("ck_attendances_sequence", "sequence >= 1");
            table.HasCheckConstraint("ck_attendances_promoted_at", $"(status = '{ColumnValues.PromotedStatus}') = (promoted_at IS NOT NULL)");
            table.HasCheckConstraint("ck_attendances_channel", $"channel IN ({EnumColumns.SqlList(ColumnValues.AttendanceChannels)})");
        });
        builder.HasKey(attendance => new { attendance.RoundId, attendance.MemberId }).HasName("pk_attendances");
        builder.Property(attendance => attendance.RoundId).HasColumnName("round_id");
        builder.Property(attendance => attendance.MemberId).HasColumnName("member_id");
        builder.Property(attendance => attendance.Status).HasColumnName("status").HasColumnType("text");
        builder.Property(attendance => attendance.Sequence).HasColumnName("sequence");
        builder.Property(attendance => attendance.Source).HasColumnName("source").HasColumnType("text");
        builder.Property(attendance => attendance.RespondedAt).HasColumnName("responded_at").HasColumnType(TimestampType);
        builder.Property(attendance => attendance.PromotedAt).HasColumnName("promoted_at").HasColumnType(TimestampType);
        builder.Property(attendance => attendance.Channel).HasColumnName("channel").HasColumnType("text")
            .HasDefaultValue(ColumnValues.AttendanceChannels[Domain.Attendances.AttendanceChannel.App]);

        builder.HasOne<RoundRow>().WithMany().HasForeignKey(attendance => attendance.RoundId)
            .HasConstraintName("fk_attendances_rounds").OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(attendance => new { attendance.RoundId, attendance.Sequence }).IsUnique().HasDatabaseName(SequenceIndex)
            .HasFilter($"status <> '{ColumnValues.NotGoingStatus}'");
        // The personal data export reads by member, across rounds (E3.16); the primary key starts with the round.
        builder.HasIndex(attendance => attendance.MemberId).HasDatabaseName(MemberIndex);
    }
}
