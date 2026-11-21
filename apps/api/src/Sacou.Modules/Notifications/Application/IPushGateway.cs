namespace Sacou.Modules.Notifications.Application;

/// <summary>
/// The port to the push service (Expo, <c>ExpoPushGateway</c>). Internal, as the token it carries: no other module sees
/// it, and only the integration tests (the one friend assembly besides the module's own tests) swap it for a fake.
/// Without <c>SACOU_EXPO_ACCESS_TOKEN</c> it is off: nothing is claimed and the deliveries stay pending.
/// </summary>
internal interface IPushGateway
{
    /// <summary>False when nothing may be sent: the pump then claims nothing.</summary>
    bool IsEnabled { get; }

    /// <summary>One result per message, in any order, by <see cref="PushMessage.DeliveryId"/>. A message without a result is ambiguous.</summary>
    Task<IReadOnlyList<PushResult>> SendAsync(IReadOnlyList<PushMessage> messages, CancellationToken cancellationToken);

    /// <summary>The receipts the service has of these tickets; a ticket it does not answer about is left out.</summary>
    Task<IReadOnlyList<PushReceipt>> GetReceiptsAsync(IReadOnlyList<string> ticketIds, CancellationToken cancellationToken);
}

/// <summary>What the service said about a ticket after handing it to Google or Apple. <see cref="Code"/> is its code.</summary>
internal sealed record PushReceipt(string TicketId, PushReceiptKind Kind, string? Code = null);

internal enum PushReceiptKind
{
    /// <summary>Handed to the phone's service (FCM or APNs).</summary>
    Delivered,

    /// <summary>The token no longer reaches a phone: the device is turned off.</summary>
    DeviceNotRegistered,

    /// <summary>Surely not handed over (credentials, size, rate): never sent again, the notification stays on screen 28.</summary>
    Failed,
}

/// <summary>
/// One push to one phone (ADR 0069, D6). The token is a personal datum and the capability to reach the phone: never
/// logged, never answered. <see cref="Data"/> carries only ids and a closed kind.
/// </summary>
internal sealed record PushMessage(Guid DeliveryId, string To, string Title, string Body, PushData Data, DateTimeOffset Expiration)
{
    /// <summary>Never prints the token.</summary>
    public override string ToString() => $"PushMessage {{ DeliveryId = {DeliveryId} }}";
}

/// <summary>What the app reads when the push is tapped: the kind and three ids, nothing else.</summary>
internal sealed record PushData(string Kind, Guid NotificationId, Guid GroupId, Guid RoundId);

/// <summary>What the push service said about one message. <see cref="Code"/> is the service's code, never a token.</summary>
internal sealed record PushResult(Guid DeliveryId, PushResultKind Kind, string? TicketId = null, string? Code = null);

internal enum PushResultKind
{
    /// <summary>Taken by the service, with its ticket: the receipt comes later.</summary>
    Accepted,

    /// <summary>The token no longer reaches a phone: the device is turned off.</summary>
    DeviceNotRegistered,

    /// <summary>Surely not taken, and worth another try (rate limit, a 5xx with no ticket).</summary>
    Retry,

    /// <summary>Surely not taken, and another try would fail the same way (our defect or a credential).</summary>
    Failed,

    /// <summary>Maybe taken (a timeout after the body went): never sent again, so never twice (ADR 0069, D5).</summary>
    Ambiguous,
}
