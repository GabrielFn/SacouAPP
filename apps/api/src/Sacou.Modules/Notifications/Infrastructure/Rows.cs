namespace Sacou.Modules.Notifications.Infrastructure;

/// <summary>
/// A row of <c>notifications.notifications</c>: only ids, a kind and instants (ADR 0069, D3). The text is rendered on
/// read; the recipient is the member, never a user (ADR 0012).
/// </summary>
internal sealed class NotificationRow
{
    public required Guid Id { get; init; }

    public required string DedupeKey { get; init; }

    public required string Kind { get; init; }

    public required Guid MemberId { get; init; }

    public required Guid GroupId { get; init; }

    public required Guid RoundId { get; init; }

    public required DateTimeOffset CreatedAt { get; init; }

    /// <summary>The round's start: a push after it does not go.</summary>
    public required DateTimeOffset ExpiresAt { get; init; }

    public DateTimeOffset? ReadAt { get; init; }
}

/// <summary>
/// A row of <c>notifications.push_devices</c> (ADR 0069, D8). The only place of the module with a user id and a token:
/// neither ever leaves it, nor reaches a log, an answer or the export.
/// </summary>
internal sealed class PushDeviceRow
{
    public required Guid Id { get; init; }

    public required Guid UserId { get; init; }

    /// <summary>A random id the app keeps for the push only, never the court's device id.</summary>
    public required Guid InstallationId { get; init; }

    public required string ExpoToken { get; init; }

    public required string Platform { get; init; }

    public required DateTimeOffset CreatedAt { get; init; }

    public required DateTimeOffset LastSeenAt { get; init; }

    public DateTimeOffset? DisabledAt { get; init; }

    public string? DisabledReason { get; init; }
}

/// <summary>A row of <c>notifications.push_deliveries</c>: one notification to one phone, at most once (ADR 0069, D5).</summary>
internal sealed class PushDeliveryRow
{
    public required Guid Id { get; init; }

    public required Guid NotificationId { get; init; }

    public required Guid DeviceId { get; init; }

    public required string State { get; init; }

    public required int Attempts { get; init; }

    public required DateTimeOffset NextAttemptAt { get; init; }

    public DateTimeOffset? LeaseUntil { get; init; }

    /// <summary>The push service's ticket, to read the receipt (part 2).</summary>
    public string? TicketId { get; init; }

    /// <summary>The push service's error code, never a token.</summary>
    public string? ErrorCode { get; init; }

    public required DateTimeOffset CreatedAt { get; init; }

    public required DateTimeOffset UpdatedAt { get; init; }
}
