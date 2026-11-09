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
        if (keys.Count > 0 && keys.All(key => key is not null))
        {
            return keys.ToFrozenDictionary(key => key!.KeyId, key => key!, StringComparer.Ordinal);
        }

        // The document is refused whole, so the certificates read before the bad entry are released.
        keys.ForEach(key => key?.Certificate.Dispose());
        return null;
    }

    private static X509SecurityKey? ReadKey(JsonProperty entry)
    {
        if (entry.Name.Length == 0
            || entry.Value.ValueKind != JsonValueKind.String
            || entry.Value.GetString() is not { } pem)
        {
            return null;
        }

        X509Certificate2 certificate;
        try
        {
            certificate = X509Certificate2.CreateFromPem(pem);
        }
        catch (CryptographicException)
        {
            return null;
        }

        using var rsa = certificate.GetRSAPublicKey();
        if (rsa is null)
        {
            // Not an RSA certificate: refused, and released here because no key keeps it.
            certificate.Dispose();
            return null;
        }

        return new X509SecurityKey(certificate, entry.Name);
    }
}
