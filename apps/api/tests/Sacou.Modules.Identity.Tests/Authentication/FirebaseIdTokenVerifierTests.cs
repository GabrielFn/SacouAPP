using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Sacou.Modules.Identity.Authentication;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Modules.Identity.Tests.Authentication;

/// <summary>The category each refusal logs, with an in-memory key source. HTTP shape is in the refusal matrix.</summary>
public sealed class FirebaseIdTokenVerifierTests : IDisposable
{
    private readonly TestSigningKey key = TestSigningKey.Create("known");
    private readonly TestSigningKey impostor = TestSigningKey.Create("known");
    private readonly DateTimeOffset now = FixedTimeProvider.WholeSecondNow();

    [Fact]
    public async Task ValidToken_IsVerified()
    {
        var login = await VerifyAsync(Valid().Sign());

        Assert.True(login.IsSuccess);
        Assert.Equal(TestIdToken.Subject, login.Value.Subject.Value);
    }

    [Fact]
    public async Task EachShapeOrHeaderProblem_HasItsCategory()
    {
        Assert.Equal(IdTokenRejection.Malformed, await RejectionAsync("not-a-token"));
        Assert.Equal(IdTokenRejection.Encrypted, await RejectionAsync("a.b.c.d.e"));
        Assert.Equal(IdTokenRejection.TooLarge, await RejectionAsync(Valid().With("pad", new string('a', 9000)).Sign()));
        Assert.Equal(IdTokenRejection.DisallowedAlgorithm, await RejectionAsync((Valid().WithHeader("alg", "none") with { Signer = _ => [] }).Sign()));
        Assert.Equal(IdTokenRejection.MissingKeyId, await RejectionAsync(Valid().WithoutHeader("kid").Sign()));
        Assert.Equal(IdTokenRejection.UnknownKey, await RejectionAsync(Valid().WithHeader("kid", "other").Sign()));
    }

    [Fact]
    public async Task EachValidationProblem_HasItsCategory()
    {
        Assert.Equal(IdTokenRejection.InvalidSignature, await RejectionAsync((Valid() with { Key = impostor }).Sign()));
        Assert.Equal(IdTokenRejection.Expired, await RejectionAsync(Valid().At(now.AddSeconds(-61), "exp").Sign()));
        Assert.Equal(IdTokenRejection.WrongAudience, await RejectionAsync(Valid().With("aud", "other-project").Sign()));
        Assert.Equal(IdTokenRejection.WrongIssuer, await RejectionAsync(Valid().With("iss", "https://accounts.google.com").Sign()));
        Assert.Equal(IdTokenRejection.IssuedInTheFuture, await RejectionAsync(Valid().At(now.AddSeconds(61), "iat").Sign()));
        Assert.Equal(IdTokenRejection.DisallowedProvider, await RejectionAsync(Valid().WithRaw("firebase", TestIdToken.Firebase("phone")).Sign()));
        Assert.Equal(IdTokenRejection.Malformed, await RejectionAsync(Valid().WithRaw("sub", "\"a\",\"sub\":\"b\"").Sign()));
    }

    [Fact]
    public async Task KeysOutOfReach_AreTheirOwnCategory()
    {
        var verifier = Verifier(new MemoryKeySource(null));

        var login = await verifier.VerifyAsync(Valid().Sign(), TestContext.Current.CancellationToken);

        Assert.Equal(IdTokenRejection.SigningKeysUnavailable, login.Error.ToRejection());
    }

    public void Dispose()
    {
        key.Dispose();
        impostor.Dispose();
    }

    private TestIdToken Valid() => TestIdToken.Valid(key, now);

    private Task<Sacou.Shared.Results.Result<VerifiedLogin>> VerifyAsync(string token) =>
        Verifier(new MemoryKeySource(new X509SecurityKey(key.Certificate, key.KeyId)))
            .VerifyAsync(token, TestContext.Current.CancellationToken);

    private async Task<IdTokenRejection> RejectionAsync(string token) => (await VerifyAsync(token)).Error.ToRejection();

    private FirebaseIdTokenVerifier Verifier(ISigningKeySource source) =>
        new(source, Options.Create(new FirebaseProjectOptions { ProjectId = TestIdToken.ProjectId }), new FixedTimeProvider(now));

    /// <summary>One key, or none at all to act as Google being out of reach.</summary>
    private sealed class MemoryKeySource(X509SecurityKey? key) : ISigningKeySource
    {
        public Task<SigningKeyLookup> FindAsync(string keyId, CancellationToken cancellationToken) =>
            Task.FromResult(key switch
            {
                null => SigningKeyLookup.Unavailable,
                _ when key.KeyId == keyId => SigningKeyLookup.Found(key),
                _ => SigningKeyLookup.Unknown,
            });
    }
}
