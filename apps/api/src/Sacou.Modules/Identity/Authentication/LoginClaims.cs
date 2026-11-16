using System.Globalization;
using System.Security.Claims;

namespace Sacou.Modules.Identity.Authentication;

/// <summary>The claims of the API's principal besides the subject (ADR 0036, D7 note).</summary>
internal static class LoginClaims
{
    /// <summary>When the person last signed in for real, in Unix seconds: the token's <c>auth_time</c>.</summary>
    public const string AuthenticatedAt = "auth_time";

    /// <summary>The <see cref="AuthenticatedAt"/> claim, or null when the principal has none or it is not a number.</summary>
    public static DateTimeOffset? ReadAuthenticatedAt(ClaimsPrincipal principal)
    {
        ArgumentNullException.ThrowIfNull(principal);
        var value = principal.FindFirstValue(AuthenticatedAt);
        return long.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out var seconds)
            && seconds <= DateTimeOffset.MaxValue.ToUnixTimeSeconds()
            ? DateTimeOffset.FromUnixTimeSeconds(seconds)
            : null;
    }
}
