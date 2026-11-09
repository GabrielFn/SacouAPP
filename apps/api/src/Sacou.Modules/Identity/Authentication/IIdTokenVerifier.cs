using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.Authentication;

/// <summary>
/// Turns a bearer token into a verified login. Swapping the Firebase JWT check for another one is
/// registering another implementation (ADR 0036, D1). A failure carries an <see cref="IdTokenRejection"/> code.
/// </summary>
internal interface IIdTokenVerifier
{
    Task<Result<VerifiedLogin>> VerifyAsync(string token, CancellationToken cancellationToken);
}
