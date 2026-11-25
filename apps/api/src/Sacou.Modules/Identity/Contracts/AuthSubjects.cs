using Sacou.Modules.Identity.Domain.Users;

namespace Sacou.Modules.Identity.Contracts;

/// <summary>The format of a login's subject (the Firebase UID), for a list of them in the configuration (ADR 0085, D1).</summary>
public static class AuthSubjects
{
    /// <summary>1 to 128 visible ASCII characters, the rule of <c>AuthSubject</c>; case-sensitive.</summary>
    public static bool IsWellFormed(string? value) => AuthSubject.Create(value).IsSuccess;
}
