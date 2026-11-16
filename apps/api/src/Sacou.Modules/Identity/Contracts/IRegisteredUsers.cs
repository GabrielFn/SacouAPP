using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.Contracts;

/// <summary>
/// Whether a person still has an account, read now and never cached, for the writes that link a person to a module's
/// data (ADR 0056, D7). <see cref="ICurrentUser"/> resolves the person once, at the start of the request; a write
/// that holds the module's per-person lock asks this again, so an account deleted in between is never linked.
/// </summary>
public interface IRegisteredUsers
{
    /// <summary>Success while the user exists; <see cref="CurrentUserErrors.NotRegistered"/> once it was deleted.</summary>
    Task<Result> ConfirmAsync(Guid userId, CancellationToken cancellationToken);
}
