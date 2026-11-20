namespace Sacou.Modules.Notifications.Contracts;

/// <summary>
/// How another module asks for a notification (ADR 0069, D3): the Sessions' outbox relay calls it once per message,
/// and again after a crash. The same <see cref="NotificationRequest.DedupeKey"/> never makes a second notification,
/// nor a second delivery to a phone.
/// </summary>
public interface INotificationRequests
{
    Task RequestAsync(NotificationRequest request, CancellationToken cancellationToken);
}

/// <summary>
/// Only ids, a closed kind and the instant the notification stops mattering (the round's start): never a name, the
/// venue or a user id (ADR 0012). The recipient is the member; the Notifications finds the account behind it.
/// </summary>
public sealed record NotificationRequest(
    string DedupeKey, NotificationRequestKind Kind, Guid MemberId, Guid GroupId, Guid RoundId, DateTimeOffset ExpiresAt);

/// <summary>The kinds another module may ask for. The pilot has one (question 113).</summary>
public enum NotificationRequestKind
{
    /// <summary>The member left the waitlist and has a spot (ADR 0043, D2).</summary>
    WaitlistPromoted,
}
