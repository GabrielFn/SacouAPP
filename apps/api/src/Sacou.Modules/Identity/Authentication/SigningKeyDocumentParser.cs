using System.Collections.Frozen;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;

namespace Sacou.Modules.Identity.Authentication;

/// <summary>
/// Reads the Google document <c>{ "kid": "-----BEGIN CERTIFICATE-----..." }</c>. One bad entry refuses
/// the whole document, so the keys already cached stay, and every certificate read from a refused
/// document is released. A bad certificate never throws out of here (ADR 0036).
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
        var keys = new List<X509SecurityKey>();
        var accepted = false;
        try
        {
            foreach (var entry in root.EnumerateObject())
            {
                if (ReadKey(entry) is not { } key)
                {
                    return null;
                }

                keys.Add(key);
            }

            accepted = keys.Count > 0;
            return accepted ? keys.ToFrozenDictionary(key => key.KeyId, key => key, StringComparer.Ordinal) : null;
        }
        finally
        {
            if (!accepted)
            {
                // Refused whole (or failed midway): the certificates read so far are released.
                keys.ForEach(key => key.Certificate.Dispose());
            }
        }
    }

    private static X509SecurityKey? ReadKey(JsonProperty entry)
    {
        if (entry.Name.Length == 0
            || entry.Value.ValueKind != JsonValueKind.String
            || entry.Value.GetString() is not { } pem)
        {
            return null;
        }

        X509Certificate2? certificate = null;
        try
        {
            certificate = X509Certificate2.CreateFromPem(pem);
            // Inside the try: a key field that says RSA over invalid bytes throws here, not in CreateFromPem.
            using var rsa = certificate.GetRSAPublicKey();
            if (rsa is null)
            {
                certificate.Dispose();
                return null;
            }

            return new X509SecurityKey(certificate, entry.Name);
        }
        catch (Exception exception) when (exception is CryptographicException or ArgumentException)
        {
            certificate?.Dispose();
            return null;
        }
    }
}
