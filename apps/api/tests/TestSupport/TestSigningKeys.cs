using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;

namespace Sacou.Tests.TestSupport;

/// <summary>
/// An RSA 2048 key and a self-signed certificate made in memory for each test run. No key is ever
/// stored in the repository (docs/seguranca/segredos.md).
/// </summary>
internal sealed class TestSigningKey : IDisposable
{
    private const int KeySizeInBits = 2048;
    private static readonly TimeSpan DefaultLifetime = TimeSpan.FromDays(7);

    private TestSigningKey(string keyId, RSA rsa, X509Certificate2 certificate)
    {
        KeyId = keyId;
        Rsa = rsa;
        Certificate = certificate;
    }

    public string KeyId { get; }

    public RSA Rsa { get; }

    public X509Certificate2 Certificate { get; }

    public string CertificatePem => Certificate.ExportCertificatePem();

    public static TestSigningKey Create(string keyId, DateTimeOffset? notAfter = null)
    {
        var rsa = RSA.Create(KeySizeInBits);
        var request = new CertificateRequest(
            $"CN={keyId}", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        var end = notAfter ?? DateTimeOffset.UtcNow + DefaultLifetime;
        var certificate = request.CreateSelfSigned(end - DefaultLifetime - DefaultLifetime, end);
        return new TestSigningKey(keyId, rsa, certificate);
    }

    public byte[] SignRs256(byte[] data) =>
        Rsa.SignData(data, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);

    public void Dispose()
    {
        Certificate.Dispose();
        Rsa.Dispose();
    }
}

internal static class TestSigningKeys
{
    /// <summary>The Google document format: <c>{ "kid": "PEM" }</c>.</summary>
    public static string Document(params TestSigningKey[] keys) =>
        JsonSerializer.Serialize(keys.ToDictionary(key => key.KeyId, key => key.CertificatePem));
}
