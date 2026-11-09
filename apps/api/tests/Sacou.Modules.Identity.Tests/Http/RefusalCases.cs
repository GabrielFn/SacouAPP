using System.Security.Cryptography;
using System.Text;
using Sacou.Modules.Identity.Authentication;
using Sacou.Tests.TestSupport;

namespace Sacou.Modules.Identity.Tests.Http;

/// <summary>What a refusal case sends: the Authorization header values (none when null) and the path.</summary>
internal sealed record Attempt(IReadOnlyList<string>? Authorization, string Path = IdentityTestHost.SignInPath);

/// <summary>A refusal case: the category it must log (null when the verifier never sees a token) and how to build it.</summary>
internal sealed record RefusalCase(IdTokenRejection? Expected, Func<RefusalKeys, Attempt> Build);

/// <summary>
/// The keys and the valid token every case starts from. The control sends <see cref="Valid"/> unchanged.
/// The three RSA keys are made once per run (RSA generation is the slow part); only the token, which
/// depends on the clock, is made per case.
/// </summary>
internal sealed class RefusalKeys
{
    public const string KnownKeyId = "known-key";

    private static readonly Lazy<(TestSigningKey Known, TestSigningKey Impostor, TestSigningKey Unknown)> Shared = new(
        () => (TestSigningKey.Create(KnownKeyId), TestSigningKey.Create(KnownKeyId), TestSigningKey.Create("unknown-key")));

    private RefusalKeys(DateTimeOffset now)
    {
        Now = now;
        (Known, Impostor, Unknown) = Shared.Value;
        Valid = TestIdToken.Valid(Known, now);
    }

    /// <summary>The key the host serves. Shared by every case and kept for the whole run.</summary>
    public static TestSigningKey SharedKnown => Shared.Value.Known;

    public DateTimeOffset Now { get; }

    public TestSigningKey Known { get; }

    /// <summary>Another RSA key that claims the known <c>kid</c>.</summary>
    public TestSigningKey Impostor { get; }

    public TestSigningKey Unknown { get; }

    public TestIdToken Valid { get; }

    public static RefusalKeys Create() => new(FixedTimeProvider.WholeSecondNow());
}

/// <summary>R1 to R24 of the E3.1 plan, as one table. Each entry builds the request from the valid token.</summary>
internal static class RefusalCases
{
    /// <summary>The exact edges (60 s passes, 61 s fails) are in the pure rule tests; HTTP runs on the real clock.</summary>
    private static readonly TimeSpan JustPastSkew = TimeSpan.FromSeconds(120);
    private const int SubjectLimit = 128;
    private const int OversizedClaimLength = 9 * 1024;
    private const string AttackerUrl = "https://attacker.example/keys";

    public static readonly IReadOnlyDictionary<string, RefusalCase> All =
        new Dictionary<string, RefusalCase>
        {
            ["R1 no header"] = new(null, _ => new Attempt(null)),
            ["R2 basic scheme"] = new(IdTokenRejection.Malformed, _ => Header("Basic dXNlcjpzZW5oYQ==")),
            ["R2 bearer without token"] = new(IdTokenRejection.Malformed, _ => Header("Bearer")),
            ["R2 bearer and a space"] = new(IdTokenRejection.Malformed, _ => Header("Bearer ")),
            ["R2 extra space"] = new(IdTokenRejection.Malformed, keys => Header("Bearer  " + keys.Valid.Sign())),
            ["R2 lowercase scheme"] = new(IdTokenRejection.Malformed, keys => Header("bearer " + keys.Valid.Sign())),
            ["R3 plain text"] = new(IdTokenRejection.Malformed, _ => Bearer("not-a-token")),
            ["R3 two parts"] = new(IdTokenRejection.Malformed, keys => Bearer(string.Join('.', keys.Valid.Sign().Split('.').Take(2)))),
            ["R3 invalid base64"] = new(IdTokenRejection.Malformed, _ => Bearer("@@@.@@@.@@@")),
            ["R3 invalid header json"] = new(IdTokenRejection.Malformed, keys => Bearer(
                $"{TestIdToken.Base64Url("{not json")}.{TestIdToken.Base64Url(keys.Valid.PayloadJson)}.c2ln")),
            ["R4 signed by another key with the same kid"] = new(IdTokenRejection.InvalidSignature, keys => Bearer((keys.Valid with { Key = keys.Impostor }).Sign())),
            ["R5 payload changed after signing"] = new(IdTokenRejection.InvalidSignature, keys => Bearer(TestIdTokens.ReplacePayload(
                keys.Valid.Sign(), keys.Valid.With("sub", "someone-else").PayloadJson))),
            ["R6 alg none, empty signature"] = new(IdTokenRejection.DisallowedAlgorithm, keys => Bearer(
                (keys.Valid.WithHeader("alg", "none") with { Signer = _ => [] }).Sign())),
            ["R6 alg none, any signature"] = new(IdTokenRejection.DisallowedAlgorithm, keys => Bearer(
                (keys.Valid.WithHeader("alg", "none") with { Signer = _ => [1, 2, 3] }).Sign())),
            ["R7 HS256 with the public key PEM"] = new(IdTokenRejection.DisallowedAlgorithm, keys => Bearer(Hs256(keys, Encoding.ASCII.GetBytes(keys.Known.CertificatePem)))),
            ["R7 HS256 with the modulus"] = new(IdTokenRejection.DisallowedAlgorithm, keys => Bearer(Hs256(keys, keys.Known.Rsa.ExportParameters(false).Modulus!))),
            ["R8 RS512"] = new(IdTokenRejection.DisallowedAlgorithm, keys => Bearer(Rsa(keys, "RS512", HashAlgorithmName.SHA512, RSASignaturePadding.Pkcs1))),
            ["R8 PS256"] = new(IdTokenRejection.DisallowedAlgorithm, keys => Bearer(Rsa(keys, "PS256", HashAlgorithmName.SHA256, RSASignaturePadding.Pss))),
            ["R8 ES256"] = new(IdTokenRejection.DisallowedAlgorithm, keys => Bearer(Es256(keys))),
            ["R9 unknown kid"] = new(IdTokenRejection.UnknownKey, keys => Bearer((keys.Valid with { Key = keys.Unknown }).WithHeader("kid", keys.Unknown.KeyId).Sign())),
            ["R10 no kid"] = new(IdTokenRejection.MissingKeyId, keys => Bearer(keys.Valid.WithoutHeader("kid").Sign())),
            ["R11 jwk header"] = new(IdTokenRejection.MissingKeyId, keys => Bearer((keys.Valid with { Key = keys.Unknown })
                .WithoutHeader("kid").WithHeader("jwk", Jwk(keys.Unknown)).Sign())),
            ["R11 jku header"] = new(IdTokenRejection.UnknownKey, keys => Bearer((keys.Valid with { Key = keys.Unknown })
                .WithHeader("kid", keys.Unknown.KeyId).WithHeader("jku", AttackerUrl).Sign())),
            ["R11 x5u header"] = new(IdTokenRejection.UnknownKey, keys => Bearer((keys.Valid with { Key = keys.Unknown })
                .WithHeader("kid", keys.Unknown.KeyId).WithHeader("x5u", AttackerUrl).Sign())),
            ["R12 aud of another project"] = new(IdTokenRejection.WrongAudience, keys => Signed(keys.Valid.With("aud", "other-project"))),
            ["R12 aud list"] = new(IdTokenRejection.WrongAudience, keys => Signed(keys.Valid.With("aud", new[] { TestIdToken.ProjectId, "other-project" }))),
            ["R12 aud missing"] = new(IdTokenRejection.WrongAudience, keys => Signed(keys.Valid.Without("aud"))),
            ["R13 iss of another project"] = new(IdTokenRejection.WrongIssuer, keys => Signed(keys.Valid.With("iss", "https://securetoken.google.com/other-project"))),
            ["R13 iss accounts.google.com"] = new(IdTokenRejection.WrongIssuer, keys => Signed(keys.Valid.With("iss", "https://accounts.google.com"))),
            ["R13 iss trailing slash"] = new(IdTokenRejection.WrongIssuer, keys => Signed(keys.Valid.With("iss", TestIdToken.Issuer + "/"))),
            ["R13 iss over http"] = new(IdTokenRejection.WrongIssuer, keys => Signed(keys.Valid.With("iss", "http://securetoken.google.com/" + TestIdToken.ProjectId))),
            ["R13 iss missing"] = new(IdTokenRejection.WrongIssuer, keys => Signed(keys.Valid.Without("iss"))),
            ["R14 expired"] = new(IdTokenRejection.Expired, keys => Signed(keys.Valid.At(keys.Now - JustPastSkew, "exp"))),
            ["R14 exp missing"] = new(IdTokenRejection.MissingTime, keys => Signed(keys.Valid.Without("exp"))),
            ["R15 iat in the future"] = new(IdTokenRejection.IssuedInTheFuture, keys => Signed(keys.Valid.At(keys.Now + JustPastSkew, "iat"))),
            ["R15 iat missing"] = new(IdTokenRejection.MissingTime, keys => Signed(keys.Valid.Without("iat"))),
            ["R16 auth_time in the future"] = new(IdTokenRejection.AuthenticatedInTheFuture, keys => Signed(keys.Valid.At(keys.Now + JustPastSkew, "auth_time"))),
            ["R16 auth_time missing"] = new(IdTokenRejection.MissingTime, keys => Signed(keys.Valid.Without("auth_time"))),
            ["R17 sub empty"] = new(IdTokenRejection.InvalidSubject, keys => Signed(keys.Valid.With("sub", string.Empty))),
            ["R17 sub missing"] = new(IdTokenRejection.InvalidSubject, keys => Signed(keys.Valid.Without("sub"))),
            ["R17 sub numeric"] = new(IdTokenRejection.InvalidSubject, keys => Signed(keys.Valid.With("sub", 12345))),
            ["R17 sub of 129 characters"] = new(IdTokenRejection.InvalidSubject, keys => Signed(keys.Valid.With("sub", new string('a', SubjectLimit + 1)))),
            ["R17 sub with a space"] = new(IdTokenRejection.InvalidSubject, keys => Signed(keys.Valid.With("sub", "uid with space"))),
            ["R17 sub with a control character"] = new(IdTokenRejection.InvalidSubject, keys => Signed(keys.Valid.With("sub", "uid\u0001"))),
            ["R17 sub not ascii"] = new(IdTokenRejection.InvalidSubject, keys => Signed(keys.Valid.With("sub", "uidçã"))),
            ["R18 anonymous provider"] = new(IdTokenRejection.DisallowedProvider, keys => Signed(keys.Valid.WithRaw("firebase", TestIdToken.Firebase("anonymous")))),
            ["R18 phone provider"] = new(IdTokenRejection.DisallowedProvider, keys => Signed(keys.Valid.WithRaw("firebase", TestIdToken.Firebase("phone")))),
            ["R18 custom provider"] = new(IdTokenRejection.DisallowedProvider, keys => Signed(keys.Valid.WithRaw("firebase", TestIdToken.Firebase("custom")))),
            ["R18 firebase claim missing"] = new(IdTokenRejection.DisallowedProvider, keys => Signed(keys.Valid.Without("firebase"))),
            ["R19 tenant present"] = new(IdTokenRejection.TenantPresent, keys => Signed(keys.Valid.WithRaw(
                "firebase", """{"sign_in_provider":"password","tenant":"tenant-1"}"""))),
            ["R20 encrypted token"] = new(IdTokenRejection.Encrypted, keys => Bearer(keys.Valid.Sign() + ".ZW5j.dGFn")),
            ["R21 over 8 KB"] = new(IdTokenRejection.TooLarge, keys => Signed(keys.Valid.With("padding", new string('a', OversizedClaimLength)))),
            ["R22 token only in the query string"] = new(null, keys => new Attempt(
                null, $"{IdentityTestHost.SignInPath}?access_token={keys.Valid.Sign()}")),
            ["R23 two Authorization headers"] = new(IdTokenRejection.Malformed, keys => new Attempt([$"Bearer {keys.Valid.Sign()}", $"Bearer {keys.Valid.Sign()}"])),
            ["R24 nbf in the future"] = new(IdTokenRejection.NotYetValid, keys => Signed(keys.Valid.At(keys.Now + JustPastSkew, "nbf"))),
        };

    private static Attempt Header(string value) => new([value]);

    private static Attempt Bearer(string token) => Header($"Bearer {token}");

    private static Attempt Signed(TestIdToken token) => Bearer(token.Sign());

    private static string Hs256(RefusalKeys keys, byte[] secret) =>
        (keys.Valid.WithHeader("alg", "HS256") with { Signer = data => HMACSHA256.HashData(secret, data) }).Sign();

    private static string Rsa(RefusalKeys keys, string algorithm, HashAlgorithmName hash, RSASignaturePadding padding) =>
        (keys.Valid.WithHeader("alg", algorithm) with { Signer = data => keys.Known.Rsa.SignData(data, hash, padding) }).Sign();

    private static string Es256(RefusalKeys keys)
    {
        using var ecdsa = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        return (keys.Valid.WithHeader("alg", "ES256") with
        {
            Signer = data => ecdsa.SignData(data, HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation),
        }).Sign();
    }

    private static Dictionary<string, string> Jwk(TestSigningKey key)
    {
        var parameters = key.Rsa.ExportParameters(false);
        return new Dictionary<string, string>
        {
            ["kty"] = "RSA",
            ["n"] = Microsoft.IdentityModel.Tokens.Base64UrlEncoder.Encode(parameters.Modulus),
            ["e"] = Microsoft.IdentityModel.Tokens.Base64UrlEncoder.Encode(parameters.Exponent),
        };
    }
}
