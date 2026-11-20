using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;

namespace Sacou.Modules.Matches.Infrastructure;

/// <summary>
/// <c>matches.court_sessions</c>: the id is the one the phone made when it opened the court (ADR 0038).
/// One court per round in the pilot (question 70): the unique index on <c>round_id</c> (ADR 0060, D7). No
/// foreign key to another module's table: <c>group_id</c> and <c>round_id</c> are checked by the contracts
/// (ADR 0037). The counters and the batch carry the stream ceilings as CHECKs, the last barrier after the domain's
/// (ADR 0060, D9; ADR 0063, D10).
/// </summary>
internal sealed class CourtSessionConfiguration : IEntityTypeConfiguration<CourtSessionRow>
{
    public const string Table = "court_sessions";
    public const string RoundIndex = "ux_court_sessions_round";

    /// <summary>The streams of a group, for the projections of the Stats (E3.9, ADR 0071): no scan of the table.</summary>
    public const string GroupIndex = "ix_court_sessions_group";

    /// <summary>The columns of the stored scoreboard: the open match, the set, and the points and sets of each team.</summary>
    private const int ScoreboardColumns = 6;

    public void Configure(EntityTypeBuilder<CourtSessionRow> builder)
    {
        builder.ToTable(Table, table =>
        {
            table.HasCheckConstraint(
                "ck_court_sessions_current_batch",
                $"current_batch BETWEEN {CourtStreamLimits.FirstBatch} AND {CourtStreamLimits.MaxWritersPerStream}");
            // The scoreboard is all there (an open match) or all null (ADR 0063, D6).
            table.HasCheckConstraint(
                "ck_court_sessions_scoreboard",
                $"num_nulls(open_match_id, set_number, points_a, points_b, sets_a, sets_b) IN (0, {ScoreboardColumns})");
            table.HasCheckConstraint("ck_court_sessions_event_count", $"event_count BETWEEN 0 AND {CourtStreamLimits.MaxStreamEvents}");
            table.HasCheckConstraint("ck_court_sessions_envelope_bytes", $"envelope_bytes BETWEEN 0 AND {CourtStreamLimits.MaxStreamBytes}");
        });
        builder.HasKey(session => session.Id).HasName("pk_court_sessions");
        builder.Property(session => session.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(session => session.GroupId).HasColumnName("group_id");
        builder.Property(session => session.RoundId).HasColumnName("round_id");
        builder.Property(session => session.CurrentBatch).HasColumnName("current_batch");
        builder.Property(session => session.EventCount).HasColumnName("event_count");
        builder.Property(session => session.EnvelopeBytes).HasColumnName("envelope_bytes");
        builder.Property(session => session.CreatedAt).HasColumnName("created_at").HasColumnType(ColumnTypes.Timestamp);
        builder.Property(session => session.LastEventAt).HasColumnName("last_event_at").HasColumnType(ColumnTypes.Timestamp);
        builder.Property(session => session.OpenMatchId).HasColumnName("open_match_id");
        builder.Property(session => session.SetNumber).HasColumnName("set_number");
        builder.Property(session => session.PointsA).HasColumnName("points_a");
        builder.Property(session => session.PointsB).HasColumnName("points_b");
        builder.Property(session => session.SetsA).HasColumnName("sets_a");
        builder.Property(session => session.SetsB).HasColumnName("sets_b");

        builder.HasIndex(session => session.RoundId).IsUnique().HasDatabaseName(RoundIndex);
        builder.HasIndex(session => session.GroupId).HasDatabaseName(GroupIndex);
    }
}

/// <summary>
/// <c>matches.court_writers</c>: one row per batch (ADR 0060, D4). The device id is tied to a <c>MemberId</c>
/// here and only here: a pseudonym in the inventory, exported by member id (D16, <c>ix_court_writers_member</c>).
/// </summary>
internal sealed class CourtWriterConfiguration : IEntityTypeConfiguration<CourtWriterRow>
{
    public const string Table = "court_writers";

    public void Configure(EntityTypeBuilder<CourtWriterRow> builder)
    {
        builder.ToTable(Table, table =>
        {
            table.HasCheckConstraint(
                "ck_court_writers_batch", $"batch BETWEEN {CourtStreamLimits.FirstBatch} AND {CourtStreamLimits.MaxWritersPerStream}");
            table.HasCheckConstraint("ck_court_writers_events_before", $"events_before BETWEEN 0 AND {CourtStreamLimits.MaxStreamEvents}");
        });
        builder.HasKey(writer => new { writer.CourtSessionId, writer.Batch }).HasName("pk_court_writers");
        builder.Property(writer => writer.CourtSessionId).HasColumnName("court_session_id");
        builder.Property(writer => writer.Batch).HasColumnName("batch");
        builder.Property(writer => writer.DeviceId).HasColumnName("device_id");
        builder.Property(writer => writer.MemberId).HasColumnName("member_id");
        builder.Property(writer => writer.EventsBefore).HasColumnName("events_before");
        builder.Property(writer => writer.StartedAt).HasColumnName("started_at").HasColumnType(ColumnTypes.Timestamp);

        builder.HasOne<CourtSessionRow>().WithMany().HasForeignKey(writer => writer.CourtSessionId)
            .HasConstraintName("fk_court_writers_court_sessions").OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(writer => writer.MemberId).HasDatabaseName("ix_court_writers_member");
    }
}

/// <summary>
/// <c>matches.court_events</c>: the envelope in <c>text</c>, never <c>jsonb</c>, which would reorder the keys and
/// rewrite the numbers; the replay reads it back through the same parser as the request (ADR 0060, D13). The
/// unique indexes are the last barrier behind the stream's lock: one row per event id, and one per
/// <c>(batch, sequence, device)</c>.
/// </summary>
internal sealed class CourtEventConfiguration : IEntityTypeConfiguration<CourtEventRow>
{
    public const string Table = "court_events";

    /// <summary>The longest type of the closed list is far shorter; the CHECK only bounds what a bug could store.</summary>
    public const int MaxTypeBytes = 64;

    public void Configure(EntityTypeBuilder<CourtEventRow> builder)
    {
        builder.ToTable(Table, table =>
        {
            table.HasCheckConstraint("ck_court_events_position", "position >= 1");
            table.HasCheckConstraint("ck_court_events_type", $"octet_length(type) <= {MaxTypeBytes}");
            table.HasCheckConstraint("ck_court_events_envelope", $"octet_length(envelope) <= {CourtStreamLimits.MaxEnvelopeBytes}");
        });
        builder.HasKey(item => new { item.CourtSessionId, item.Position }).HasName("pk_court_events");
        builder.Property(item => item.CourtSessionId).HasColumnName("court_session_id");
        builder.Property(item => item.Position).HasColumnName("position").ValueGeneratedNever();
        builder.Property(item => item.EventId).HasColumnName("event_id");
        builder.Property(item => item.Batch).HasColumnName("batch");
        builder.Property(item => item.Sequence).HasColumnName("sequence");
        builder.Property(item => item.DeviceId).HasColumnName("device_id");
        builder.Property(item => item.SchemaVersion).HasColumnName("schema_version");
        builder.Property(item => item.Type).HasColumnName("type").HasColumnType("text");
        builder.Property(item => item.MatchId).HasColumnName("match_id");
        builder.Property(item => item.Envelope).HasColumnName("envelope").HasColumnType("text");
        builder.Property(item => item.ReceivedAt).HasColumnName("received_at").HasColumnType(ColumnTypes.Timestamp);

        builder.HasOne<CourtSessionRow>().WithMany().HasForeignKey(item => item.CourtSessionId)
            .HasConstraintName("fk_court_events_court_sessions").OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(item => new { item.CourtSessionId, item.EventId }).IsUnique().HasDatabaseName("ux_court_events_event_id");
        builder.HasIndex(item => new { item.CourtSessionId, item.Batch, item.Sequence, item.DeviceId })
            .IsUnique().HasDatabaseName("ux_court_events_batch_sequence_device");
    }
}

internal static class ColumnTypes
{
    public const string Timestamp = "timestamp with time zone";
}
