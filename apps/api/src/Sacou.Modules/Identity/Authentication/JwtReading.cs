using System.Text.Json;
using Microsoft.Extensions.Primitives;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Sacou.Modules.Identity.Authentication;

/// <summary>
/// What both token checks read the same way (ADR 0036 and ADR 0069, D11): the one bearer header, the header of a signed
/// JWT without trusting it, and the payload as strict JSON. Nothing here logs or echoes a token.
/// </summary>
internal static class JwtReading
{
    /// <summary>An ID token is about 1 KB; a Google OIDC token too.</summary>
    public const int MaximumTokenSizeInBytes = 8 * 1024;

    public const int SignedTokenParts = 3;
    public const char PartSeparator = '.';

    private const string BearerPrefix = "Bearer ";

    private static readonly JsonDocumentOptions StrictJson = new() { AllowDuplicateProperties = false };

    /// <summary>Exactly one header, the scheme in its usual case, and a token with no spaces.</summary>
    public static string? ReadBearerToken(StringValues headers)
    {
        var value = headers.Count == 1 ? headers[0] : null;
        if (value is null || !value.StartsWith(BearerPrefix, StringComparison.Ordinal))
        {
            return null;
        }

        var token = value[BearerPrefix.Length..];
        return token.Length > 0 && !token.Any(char.IsWhiteSpace) ? token : null;
    }

    /// <summary>Null for a token too large, not of three parts, or whose header the library cannot read.</summary>
    public static JsonWebToken? ReadHeader(JsonWebTokenHandler handler, string token)
    {
        ArgumentNullException.ThrowIfNull(handler);
        ArgumentNullException.ThrowIfNull(token);
        if (token.Length > MaximumTokenSizeInBytes || token.Split(PartSeparator).Length != SignedTokenParts)
        {
            return null;
        }

        try
        {
            return handler.ReadJsonWebToken(token);
        }
        catch (ArgumentException)
        {
            // SecurityTokenMalformedException derives from ArgumentException. Its message may echo the token.
            return null;
        }
    }

    /// <summary>The payload of a token whose signature passed, as a JSON object; null when it is not one or has a key twice.</summary>
    public static JsonElement? ReadPayload(JsonWebToken token)
    {
        ArgumentNullException.ThrowIfNull(token);
        try
        {
            using var document = JsonDocument.Parse(Base64UrlEncoder.Decode(token.EncodedPayload), StrictJson);
            return document.RootElement.ValueKind == JsonValueKind.Object ? document.RootElement.Clone() : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
