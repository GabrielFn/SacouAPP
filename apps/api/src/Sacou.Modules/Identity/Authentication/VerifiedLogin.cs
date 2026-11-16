using Sacou.Modules.Identity.Domain.Users;

namespace Sacou.Modules.Identity.Authentication;

/// <summary>
/// What a verified ID token proves. Nothing about Firebase, and no e-mail or name. <see cref="AuthenticatedAt"/> is
/// the token's <c>auth_time</c>, when the person last typed the password or chose the account: only the account
/// deletion reads it (E3.16, ADR 0056, D4).
/// </summary>
internal sealed record VerifiedLogin(AuthSubject Subject, SignInProvider Provider, DateTimeOffset AuthenticatedAt);
