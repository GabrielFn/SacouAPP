using System.Text.RegularExpressions;

namespace Sacou.Api.Observability;

/// <summary>
/// The text filter of everything that leaves for Sentry (ADR 0080, D4): an e-mail, a bearer token, a JWT or a Pix
/// copy-and-paste code inside a message becomes <see cref="Redacted"/>. A safety net behind the allow lists, which
/// already drop every field that is not known to be safe.
/// </summary>
internal static partial class SensitiveText
{
    internal const string Redacted = "[filtrado]";

    internal const string RedactedId = "[id]";

    private const int PatternTimeoutMilliseconds = 100;

    internal static string? Redact(string? text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return text;
        }

        var withoutBearer = BearerPattern().Replace(text, Redacted);
        var withoutJwt = JwtPattern().Replace(withoutBearer, Redacted);
        var withoutPix = PixPattern().Replace(withoutJwt, Redacted);
        return EmailPattern().Replace(withoutPix, Redacted);
    }

    /// <summary>Every GUID becomes <see cref="RedactedId"/>: in a breadcrumb it may be a <c>MemberId</c> (ADR 0080, D4).</summary>
    internal static string? RedactIds(string? text) =>
        string.IsNullOrEmpty(text) ? text : GuidPattern().Replace(text, RedactedId);

    [GeneratedRegex(@"\b[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\b", RegexOptions.CultureInvariant, PatternTimeoutMilliseconds)]
    private static partial Regex GuidPattern();

    [GeneratedRegex(@"\bBearer\s+\S+", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, PatternTimeoutMilliseconds)]
    private static partial Regex BearerPattern();

    /// <summary>A JWT header always starts with <c>{"</c>, which is <c>eyJ</c> in base64url.</summary>
    [GeneratedRegex(@"\beyJ[A-Za-z0-9_\-]*(\.[A-Za-z0-9_\-]*)*", RegexOptions.CultureInvariant, PatternTimeoutMilliseconds)]
    private static partial Regex JwtPattern();

    /// <summary>The EMV payload of a Pix code starts with the format indicator <c>000201</c>.</summary>
    [GeneratedRegex(@"000201\S*", RegexOptions.CultureInvariant, PatternTimeoutMilliseconds)]
    private static partial Regex PixPattern();

    [GeneratedRegex(@"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}", RegexOptions.CultureInvariant, PatternTimeoutMilliseconds)]
    private static partial Regex EmailPattern();
}
