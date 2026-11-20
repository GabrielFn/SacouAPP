namespace Sacou.Modules.Notifications.Contracts;

/// <summary>
/// What the notification list shows of a round, read when the list is read (ADR 0069, D7): a notification stores only
/// ids, so a moved round or a renamed group shows right. Implemented by the Sessions (dependency inversion: the
/// Notifications never references it). Always by <c>(groupId, roundId)</c>, never by a bare round id.
/// </summary>
public interface INotificationRounds
{
    /// <summary>The rounds found among <paramref name="rounds"/>; a missing one is left out.</summary>
    Task<IReadOnlyList<NotificationRound>> FindAsync(IReadOnlyCollection<NotificationRoundKey> rounds, CancellationToken cancellationToken);
}

public sealed record NotificationRoundKey(Guid GroupId, Guid RoundId);

/// <summary>The local date and time as stored in the round, never converted; the venue only for the list, never for a push.</summary>
public sealed record NotificationRound(Guid GroupId, Guid RoundId, DateOnly LocalDate, TimeOnly LocalTime, string Venue);
