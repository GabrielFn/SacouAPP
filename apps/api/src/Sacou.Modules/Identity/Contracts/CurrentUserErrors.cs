using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.Contracts;

public static class CurrentUserErrors
{
    /// <summary>403, not 401: the app calls <c>POST /v1/me</c> and repeats, without signing the person out.</summary>
    public static readonly Error NotRegistered = new("identity.user-not-registered", ErrorKind.Forbidden);
}
