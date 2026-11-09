using System.Security.Cryptography;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Sacou.Modules.Identity.Authentication;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Modules.Identity.Tests.Authentication;

/// <summary>Only RS256 passes the header check: any other algorithm is its own category, before any key lookup.</summary>
public sealed class AlgorithmAllowListTests : IDisposable
{
    private readonly TestSigningKey key = TestSigningKey.Create("known");
    private readonly DateTimeOffset now = FixedTimeProvider.WholeSecondNow();

    [Theory]
    [InlineData("HS256")]
    [InlineData("HS384")]
    [InlineData("RS384")]
    [InlineData("RS512")]
    [InlineData("ES256")]
    [InlineData("PS256")]
    [InlineData("rs256")]
    public async Task OtherAlgorithm_IsDisallowedByTheHeaderCheck(string algorithm)
    {
        var secret = key.Certificate.RawData;
        var token = (TestIdToken.Valid(key, now).WithHeader("alg", algorithm) with { Signer = data => HMACSHA256.HashData(secret, data) }).Sign();
        var verifier = new FirebaseIdTokenVerifier(
            new SingleKeySource(new X509SecurityKey(key.Certificate, key.KeyId)),
            Options.Create(new FirebaseProjectOptions { ProjectId = TestIdToken.ProjectId }),
            new FixedTimeProvider(now));

        var result = await verifier.VerifyAsync(token, TestContext.Current.CancellationToken);

        Assert.Equal(IdTokenRejection.DisallowedAlgorithm, result.Error.ToRejection());
    }

    public void Dispose() => key.Dispose();

    private sealed class SingleKeySource(X509SecurityKey key) : ISigningKeySource
    {
        public Task<SigningKeyLookup> FindAsync(string keyId, CancellationToken cancellationToken) =>
            Task.FromResult(key.KeyId == keyId ? SigningKeyLookup.Found(key) : SigningKeyLookup.Unknown);
    }
}
