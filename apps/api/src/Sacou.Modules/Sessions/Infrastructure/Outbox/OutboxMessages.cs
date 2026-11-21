using System.Collections.Immutable;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sacou.Modules.Sessions.Domain.Rounds;

namespace Sacou.Modules.Sessions.Infrastructure.Outbox;

/// <summary>
/// A row of <c>sessions.outbox_messages</c> (ADR 0069, D1): written in the transaction of the round's lock, so a write
/// that rolls back leaves none. The payload has only ids, numbers and an instant (<see cref="OutboxPayload"/>).
/// </summary>
internal sealed class OutboxMessageRow
{
    public required Guid Id { get; init; }

    public required string DedupeKey { get; init; }

    public required string Type { get; init; }

    public required string Payload { get; init; }

    public required DateTimeOffset OccurredAt { get; init; }

    public DateTimeOffset? ProcessedAt { get; init; }

    /// <summary>
    /// Set when the relay gave up on the message (out of shape, or failed <c>MaxAttempts</c> times): out of the line, but
    /// never counted as processed, so a query or an alert tells one from the other (ADR 0069, D3).
    /// </summary>
    public DateTimeOffset? SetAsideAt { get; init; }

    public required int Attempts { get; init; }
}

/// <summary>
/// The closed shape of a promotion's payload: <c>roundId</c>, <c>groupId</c>, <c>memberId</c>, <c>sequence</c> and
/// <c>startsAt</c>, all required; another field is refused on reading, so no personal datum can slip in unseen.
/// </summary>
internal sealed record OutboxPayload(
    [property: JsonRequired] Guid RoundId,
    [property: JsonRequired] Guid GroupId,
    [property: JsonRequired] Guid MemberId,
    [property: JsonRequired] int Sequence,
    [property: JsonRequired] DateTimeOffset StartsAt)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        AllowDuplicateProperties = false,
    };

    public string ToJson() => JsonSerializer.Serialize(this, Json);

    /// <summary>Null for a payload out of shape, which the relay logs by the message id and sets aside.</summary>
    public static OutboxPayload? Read(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<OutboxPayload>(json, Json);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}

/// <summary>The messages the Sessions writes. One type in the pilot.</summary>
internal static class OutboxMessages
{
    public const string WaitlistPromotedType = "sessions.waitlist-promoted";

    public static readonly ImmutableArray<string> Types = [WaitlistPromotedType];

    /// <summary>
    /// <c>sessions.waitlist-promoted:{roundId}:{memberId}:{sequence}</c>: the same request repeated gives the same key, and
    /// a member who left and came back has another sequence, so another key (ADR 0043, D3).
    /// </summary>
    public static string DedupeKey(WaitlistPromoted promoted)
    {
        ArgumentNullException.ThrowIfNull(promoted);
        return string.Create(
            CultureInfo.InvariantCulture, $"{WaitlistPromotedType}:{promoted.RoundId.Value:D}:{promoted.MemberId.Value:D}:{promoted.Sequence}");
    }

    public static OutboxMessageRow For(Round round, WaitlistPromoted promoted)
    {
        ArgumentNullException.ThrowIfNull(round);
        ArgumentNullException.ThrowIfNull(promoted);
        return new OutboxMessageRow
        {
            Id = Guid.CreateVersion7(promoted.PromotedAt),
            DedupeKey = DedupeKey(promoted),
            Type = WaitlistPromotedType,
            Payload = new OutboxPayload(round.Id.Value, round.GroupId.Value, promoted.MemberId.Value, promoted.Sequence, round.Slot.StartsAt).ToJson(),
            OccurredAt = promoted.PromotedAt,
            Attempts = 0,
        };
    }
}

/// <summary><c>sessions.outbox_messages</c>, with the partial index the relay reads: only the unprocessed rows.</summary>
internal sealed class OutboxMessageConfiguration : IEntityTypeConfiguration<OutboxMessageRow>
{
    public const string Table = "outbox_messages";
    public const string DedupeIndex = "ux_outbox_messages_dedupe_key";

    /// <summary>The messages still in the line: neither processed nor set aside.</summary>
    public const string InLineFilter = "processed_at IS NULL AND set_aside_at IS NULL";

    private const string TimestampType = "timestamp with time zone";

    public void Configure(EntityTypeBuilder<OutboxMessageRow> builder)
    {
        builder.ToTable(Table, table =>
        {
            table.HasCheckConstraint("ck_outbox_messages_type", $"type IN ({string.Join(", ", OutboxMessages.Types.Select(type => $"'{type}'"))})");
            table.HasCheckConstraint("ck_outbox_messages_attempts", "attempts >= 0");
            table.HasCheckConstraint("ck_outbox_messages_one_end", "processed_at IS NULL OR set_aside_at IS NULL");
        });
        builder.HasKey(message => message.Id).HasName("pk_outbox_messages");
        builder.Property(message => message.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(message => message.DedupeKey).HasColumnName("dedupe_key").HasColumnType("text");
        builder.Property(message => message.Type).HasColumnName("type").HasColumnType("text");
        builder.Property(message => message.Payload).HasColumnName("payload").HasColumnType("jsonb");
        builder.Property(message => message.OccurredAt).HasColumnName("occurred_at").HasColumnType(TimestampType);
        builder.Property(message => message.ProcessedAt).HasColumnName("processed_at").HasColumnType(TimestampType);
        builder.Property(message => message.SetAsideAt).HasColumnName("set_aside_at").HasColumnType(TimestampType);
        builder.Property(message => message.Attempts).HasColumnName("attempts");

        builder.HasIndex(message => message.DedupeKey).IsUnique().HasDatabaseName(DedupeIndex);
        builder.HasIndex(message => new { message.OccurredAt, message.Id }).HasDatabaseName("ix_outbox_messages_unprocessed")
            .HasFilter(InLineFilter);
    }
}
