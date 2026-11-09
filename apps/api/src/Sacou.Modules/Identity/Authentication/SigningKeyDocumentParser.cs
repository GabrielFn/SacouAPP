using System.Collections.Frozen;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;

namespace Sacou.Modules.Identity.Authentication;

/// <summary>
/// Reads the Google document <c>{ "kid": "-----BEGIN CERTIFICATE-----..." }</c>. One bad entry refuses
/// the whole document, so the keys already cached stay (ADR 0036).
/// </summary>
internal static class SigningKeyDocumentParser
{
    private static readonly JsonDocumentOptions StrictJson = new() { AllowDuplicateProperties = false };

    public static FrozenDictionary<string, X509SecurityKey>? Parse(ReadOnlyMemory<byte> document)
    {
        try
        {
            using var json = JsonDocument.Parse(document, StrictJson);
            return json.RootElement.ValueKind == JsonValueKind.Object ? ReadKeys(json.RootElement) : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static FrozenDictionary<string, X509SecurityKey>? ReadKeys(JsonElement root)
    {
        var keys = root.EnumerateObject().Select(ReadKey).ToList();
        return keys.Count > 0 && keys.All(key => key is not null)
            ? keys.ToFrozenDictionary(key => key!.KeyId, key => key!, StringComparer.Ordinal)
            : null;
    }

    private static X509SecurityKey? ReadKey(JsonProperty entry)
    {
        if (entry.Name.Length == 0
            || entry.Value.ValueKind != JsonValueKind.String
            || entry.Value.GetString() is not { } pem)
        {
            return null;
        }

        try
        {
            var certificate = X509Certificate2.CreateFromPem(pem);
            using var rsa = certificate.GetRSAPublicKey();
            return rsa is null ? null : new X509SecurityKey(certificate, entry.Name);
        }
        catch (CryptographicException)
        {
            return null;
        }
    }
}
