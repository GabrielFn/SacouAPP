using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.Contracts;

/// <summary>
/// The signed-in person of the current request, for the other modules (ADR 0039). Fails with
/// <see cref="CurrentUserErrors.NotRegistered"/> when the login is valid but <c>POST /v1/me</c> never ran.
/// </summary>
public interface ICurrentUser
{
    Task<Result<CurrentUser>> GetAsync(CancellationToken cancellationToken);
}
