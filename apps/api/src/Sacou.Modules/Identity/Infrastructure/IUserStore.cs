using Sacou.Modules.Identity.Domain.Users;

namespace Sacou.Modules.Identity.Infrastructure;

/// <summary>Where users live. The Postgres store makes the first sign-in atomic (ADR 0037, D6).</summary>
internal interface IUserStore
{
    Task<UserId?> FindIdAsync(AuthSubject subject, CancellationToken cancellationToken);

    /// <summary>When the user was created, for the personal data export; null when the user does not exist.</summary>
    Task<DateTimeOffset?> FindCreatedAtAsync(UserId user, CancellationToken cancellationToken);

    /// <summary>False when a user with that subject already exists, for example after a concurrent first sign-in.</summary>
    Task<bool> TryCreateAsync(User user, CancellationToken cancellationToken);
}
