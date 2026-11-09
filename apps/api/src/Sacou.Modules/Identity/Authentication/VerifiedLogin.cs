using Sacou.Modules.Identity.Domain.Users;

namespace Sacou.Modules.Identity.Authentication;

/// <summary>What a verified ID token proves. Nothing about Firebase, and no e-mail or name.</summary>
internal sealed record VerifiedLogin(AuthSubject Subject, SignInProvider Provider);
