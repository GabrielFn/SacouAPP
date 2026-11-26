using System.Text.Json;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Sacou.Modules.Identity.Authentication;

/// <summary>Why a service caller's token was refused: logged as this category only, always answered with the same 401.</summary>
internal enum ServiceCallerRejection
{
    NotConfigured,
    Malformed,
    DisallowedAlgorithm,
    MissingKeyId,
    UnknownKey,
    SigningKeysUnavailable,
    Invalid,
    WrongCaller,
    IssuedInTheFuture,
}

/// <summary>The Google OIDC keys, apart from the Firebase ones: another URL, another cache.</summary>
internal sealed class ServiceCallerSigningKeys(GoogleSigningKeySource keys) : ISigningKeySource, IDisposable
{
    public const string HttpClientName = IdentityModule.ServiceCallerKeysHttpClientName;

    /// <summary>The keys that sign the Google OIDC tokens of service accounts, in the same x509 document shape as Firebase's.</summary>
    public static readonly Uri KeysUri = new("https://www.googleapis.com/oauth2/v1/certs");

    public Task<SigningKeyLookup> FindAsync(string keyId, CancellationToken cancellationToken) => keys.FindAsync(keyId, cancellationToken);

    public void Dispose() => keys.Dispose();
}

/// <summary>
/// Verifies the Google OIDC token Cloud Tasks and Cloud Scheduler send (ADR 0069, D11): RS256 with a Google key of the
/// fixed URL, issuer Google, <c>aud</c> exactly the service's URL, <c>email</c> exactly the calling account and
/// <c>email_verified</c> true. The same checks of ADR 0036 on the shape, the header and the times.
/// </summary>
internal sealed class ServiceCallerTokenVerifier(ISigningKeySource keys, IOptions<ServiceCallerOptions> options, TimeProvider time)
{
    public const int MaximumTokenSizeInBytes = JwtReading.MaximumTokenSizeInBytes;

    /// <summary>The two forms Google documents for the issuer of its OIDC tokens.</summary>
    public static readonly string[] Issuers = ["https://accounts.google.com", "accounts.google.com"];

    private const string EmailClaim = "email";
    private const string EmailVerifiedClaim = "email_verified";
    private const string IssuedAtClaim = "iat";

    private static readonly string[] AllowedAlgorithms = [SecurityAlgorithms.RsaSha256];

    private readonly JsonWebTokenHandler handler = new() { MaximumTokenSizeInBytes = MaximumTokenSizeInBytes };

    /// <summary>Null when the token is the allowed caller's.</summary>
    public async Task<ServiceCallerRejection?> VerifyAsync(string token, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(token);
        var caller = options.Value;
        if (!caller.IsConfigured)
        {
            return ServiceCallerRejection.NotConfigured;
        }

        if (JwtReading.ReadHeader(handler, token) is not { } header)
        {
            return ServiceCallerRejection.Malformed;
        }

        if (header.Alg != SecurityAlgorithms.RsaSha256)
        {
            return ServiceCallerRejection.DisallowedAlgorithm;
        }

        if (string.IsNullOrEmpty(header.Kid))
        {
            return ServiceCallerRejection.MissingKeyId;
        }

        var lookup = await keys.FindAsync(header.Kid, cancellationToken).ConfigureAwait(false);
        return lookup switch
        {
            { Status: SigningKeyStatus.Unavailable } => ServiceCallerRejection.SigningKeysUnavailable,
            { Key: { } key } => await ValidateAsync(token, header.Kid, key, caller).ConfigureAwait(false),
            _ => ServiceCallerRejection.UnknownKey,
        };
    }

    private async Task<ServiceCallerRejection?> ValidateAsync(string token, string keyId, SecurityKey key, ServiceCallerOptions caller)
    {
        var result = await handler.ValidateTokenAsync(token, Parameters(keyId, key, caller)).ConfigureAwait(false);
        if (!result.IsValid)
        {
            return ServiceCallerRejection.Invalid;
        }

        return JwtReading.ReadPayload((JsonWebToken)result.SecurityToken) is { } payload ? Check(payload, caller, time.GetUtcNow()) : ServiceCallerRejection.Malformed;
    }

    /// <summary>The rules the library does not know: the calling account, verified, and a token not issued in the future.</summary>
    internal static ServiceCallerRejection? Check(JsonElement payload, ServiceCallerOptions caller, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(caller);
        var email = payload.TryGetProperty(EmailClaim, out var emailValue) && emailValue.ValueKind == JsonValueKind.String ? emailValue.GetString() : null;
        var verified = payload.TryGetProperty(EmailVerifiedClaim, out var verifiedValue) && verifiedValue.ValueKind == JsonValueKind.True;
        if (!verified || !string.Equals(email, caller.Email, StringComparison.Ordinal))
        {
            return ServiceCallerRejection.WrongCaller;
        }

        var issuedAt = payload.TryGetProperty(IssuedAtClaim, out var issued) && issued.TryGetInt64(out var seconds) ? seconds : (long?)null;
        return issuedAt is { } at && at <= (now + FirebaseTokenRules.ClockSkew).ToUnixTimeSeconds() ? null : ServiceCallerRejection.IssuedInTheFuture;
    }

    private static TokenValidationParameters Parameters(string keyId, SecurityKey key, ServiceCallerOptions caller) => new()
    {
        ValidAlgorithms = AllowedAlgorithms,
        RequireSignedTokens = true,
        TryAllIssuerSigningKeys = false,
        // Only the key of that kid, fetched from the fixed Google URL. jwk, jku and x5u are never read.
        IssuerSigningKeyResolver = (_, _, kid, _) => kid == keyId ? [key] : [],
        ValidateIssuer = true,
        ValidIssuers = Issuers,
        ValidateAudience = true,
        ValidAudience = caller.Audience,
        ValidateLifetime = true,
        RequireExpirationTime = true,
        ClockSkew = FirebaseTokenRules.ClockSkew,
        LogValidationExceptions = false,
        LogTokenId = false,
    };
}
