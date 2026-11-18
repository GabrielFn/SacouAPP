using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace Sacou.Http.RateLimiting;

/// <summary>
/// The partition of a signed-in user: the SHA-256, in hex, of the login's subject (the Firebase UID). Lives only in
/// the limiter's memory; never the raw UID, never in a log, a metric or an answer (ADR 0062, D1). No user, no key.
/// </summary>
internal static class RateLimitPartitionKey
{
    public static string? Of(ClaimsPrincipal user)
    {
        ArgumentNullException.ThrowIfNull(user);
        if (user.Identity?.IsAuthenticated != true)
        {
            return null;
        }

        var subject = user.FindFirstValue(ClaimTypes.NameIdentifier);
        return string.IsNullOrEmpty(subject) ? null : Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(subject)));
    }
}
