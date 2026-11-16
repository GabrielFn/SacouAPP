using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.Domain.Accounts;

/// <summary>The refusals of the account deletion and of a sign-in after it (E3.16, ADR 0056). The pt-BR texts live in the app.</summary>
internal static class AccountErrors
{
    /// <summary>403, not 401: the app asks for the password again without signing the person out (D4).</summary>
    public static readonly Error RecentLoginRequired = new("identity.recent-login-required", ErrorKind.Forbidden);

    /// <summary>409, with the ids of the groups to hand over first (D3, screen 30b).</summary>
    public static readonly Error DeletionBlocked = new("identity.deletion-blocked", ErrorKind.Conflict);

    /// <summary>410: this login's account was deleted; the app deletes the Firebase account again and signs out (D5).</summary>
    public static readonly Error AccountDeleted = new("identity.account-deleted", ErrorKind.Gone);
}
