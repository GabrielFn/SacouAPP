namespace Sacou.Shared.Retention;

/// <summary>
/// A module's deletion of what outlived its retention (ADR 0086), run as the <c>retention-cleanup</c> step of the internal
/// pump route (ADR 0069, D13) on every call: the daily Cloud Scheduler sweep and each Cloud Tasks call. Idempotent, the
/// cut depends only on the <c>now</c> it gets; in batches, it stops when the token fires and the next call takes the rest.
/// The route knows none of them by name: each module registers its own as a scoped <see cref="IRetentionCleanup"/>.
/// </summary>
public interface IRetentionCleanup
{
    Task CleanUpAsync(DateTimeOffset now, CancellationToken cancellationToken);
}
