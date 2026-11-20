namespace Sacou.Modules.Notifications.Contracts;

/// <summary>
/// The port to the push service (Expo, in part 2 of E3.11). Public only so the API's tests swap it for a fake; no module
/// calls it. The one registered in part 1 is <c>DisabledPushGateway</c>: it sends nothing and the deliveries stay pending.
/// </summary>
public interface IPushGateway
{
    /// <summary>False when nothing may be sent: the pump then claims nothing.</summary>
    bool IsEnabled { get; }

    /// <summary>One result per message, in any order, by <see cref="PushMessage.DeliveryId"/>. A message without a result is ambiguous.</summary>
    Task<IReadOnlyList<PushResult>> SendAsync(IReadOnlyList<PushMessage> messages, CancellationToken cancellationToken);
}

/// <summary>
/// One push to one phone (ADR 0069, D6). The token is a personal datum and the capability to reach the phone: never
/// logged, never answered. <see cref="Data"/> carries only ids and a closed kind.
/// </summary>
public sealed record PushMessage(Guid DeliveryId, string To, string Title, string Body, PushData Data, DateTimeOffset Expiration)
{
    /// <summary>Never prints the token.</summary>
    public override string ToString() => $"PushMessage {{ DeliveryId = {DeliveryId} }}";
}

/// <summary>What the app reads when the push is tapped: the kind and three ids, nothing else.</summary>
public sealed record PushData(string Kind, Guid NotificationId, Guid GroupId, Guid RoundId);

/// <summary>What the push service said about one message. <see cref="Code"/> is the service's code, never a token.</summary>
public sealed record PushResult(Guid DeliveryId, PushResultKind Kind, string? TicketId = null, string? Code = null);

public enum PushResultKind
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
