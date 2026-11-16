using Sacou.Modules.Identity.Domain.Users;

namespace Sacou.Modules.Identity.Infrastructure;

/// <summary>The tombstones of deleted accounts (ADR 0056, D5), by the hash of the login, never the login itself.</summary>
internal interface IDeletedAccountStore
{
    Task<bool> IsDeletedAsync(AuthSubject subject, CancellationToken cancellationToken);

    /// <summary>
    /// In one transaction, under the login's lock: the tombstone (kept if already there) and the delete of the user,
    /// whose profile goes with it (cascade). Running it again is a success that changes nothing.
    /// </summary>
    Task DeleteAsync(UserId user, AuthSubject subject, DateTimeOffset now, CancellationToken cancellationToken);
}
