namespace Sacou.Modules.Notifications.Contracts;

/// <summary>
/// Sends what is due (ADR 0069, D5). Called by a request after its write is committed, never by a background loop:
/// the Cloud Run instance has no CPU outside a request (ADR 0068). Two calls at once never send one delivery twice.
/// </summary>
public interface INotificationPump
{
    /// <summary>Stops claiming when <paramref name="cancellationToken"/> fires; whatever is left waits for the next call.</summary>
    Task RunAsync(CancellationToken cancellationToken);
}
