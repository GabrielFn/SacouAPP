using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.Authentication;

/// <summary>
/// Verifies a Firebase ID token as a JWT signed by the Google public keys, following "Verify ID tokens
/// using a third-party JWT library" (ADR 0036, D1 and D2). No FirebaseAdmin, no service account.
/// </summary>
internal sealed class FirebaseIdTokenVerifier(
    ISigningKeySource keys,
    IOptions<FirebaseProjectOptions> project,
    TimeProvider time) : IIdTokenVerifier
{
    /// <summary>An ID token is about 1 KB.</summary>
    public const int MaximumTokenSizeInBytes = JwtReading.MaximumTokenSizeInBytes;

    private const int EncryptedTokenParts = 5;
    private const char PartSeparator = JwtReading.PartSeparator;

    private readonly JsonWebTokenHandler handler = new() { MaximumTokenSizeInBytes = MaximumTokenSizeInBytes };

    public async Task<Result<VerifiedLogin>> VerifyAsync(string token, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(token);
        if (JwtReading.ReadHeader(handler, token) is not { } header)
        {
            return Refuse(ShapeRejection(token));
        }

        if (HeaderRejection(header) is { } refused)
        {
            return Refuse(refused);
        }

        var lookup = await keys.FindAsync(header.Kid, cancellationToken).ConfigureAwait(false);
        return lookup switch
        {
            { Status: SigningKeyStatus.Unavailable } => Refuse(IdTokenRejection.SigningKeysUnavailable),
            { Key: { } key } => await ValidateAsync(token, header.Kid, key).ConfigureAwait(false),
            _ => Refuse(IdTokenRejection.UnknownKey),
        };
    }

    private async Task<Result<VerifiedLogin>> ValidateAsync(string token, string keyId, SecurityKey key)
    {
        var parameters = FirebaseValidationParameters.Create(project.Value, keyId, key);
        var result = await handler.ValidateTokenAsync(token, parameters).ConfigureAwait(false);
        if (!result.IsValid)
        {
            return Refuse(FirebaseValidationParameters.RejectionFor(result.Exception));
        }

        return JwtReading.ReadPayload((JsonWebToken)result.SecurityToken) is { } payload
            ? FirebaseTokenRules.Check(payload, project.Value, time.GetUtcNow())
            : Refuse(IdTokenRejection.Malformed);
    }

    private static IdTokenRejection ShapeRejection(string token) =>
        token.Length > MaximumTokenSizeInBytes ? IdTokenRejection.TooLarge
        : token.Split(PartSeparator).Length == EncryptedTokenParts ? IdTokenRejection.Encrypted
        : IdTokenRejection.Malformed;

    private static IdTokenRejection? HeaderRejection(JsonWebToken header) =>
        header.Alg != SecurityAlgorithms.RsaSha256 ? IdTokenRejection.DisallowedAlgorithm
        : string.IsNullOrEmpty(header.Kid) ? IdTokenRejection.MissingKeyId
        : null;

    private static Result<VerifiedLogin> Refuse(IdTokenRejection rejection) =>
        Result.Failure<VerifiedLogin>(rejection.ToError());
}
