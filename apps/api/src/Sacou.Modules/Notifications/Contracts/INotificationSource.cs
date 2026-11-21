namespace Sacou.Modules.Notifications.Contracts;

/// <summary>
/// A module that asks for notifications through an outbox of its own (ADR 0069, D3 and D10): the Sessions, in the pilot.
/// The internal pump route relays every source before it sends, so a message left by a crash or a cut budget goes out
/// with the next Cloud Tasks call or the daily sweep. Inverted, as <see cref="INotificationRounds"/>: the Notifications
/// never references the source module.
/// </summary>
public interface INotificationSource
{
    /// <summary>Relays what waits in the outbox, batch after batch, until it is empty, a batch fails or the token fires.</summary>
    Task RelayAsync(CancellationToken cancellationToken);

    /// <summary>Deletes, in small batches, the outbox rows done with long enough ago (ADR 0069, D12).</summary>
    Task CleanUpAsync(DateTimeOffset now, CancellationToken cancellationToken);
}
