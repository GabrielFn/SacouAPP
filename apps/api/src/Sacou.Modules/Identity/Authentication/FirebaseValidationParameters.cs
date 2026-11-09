using Microsoft.IdentityModel.Tokens;

namespace Sacou.Modules.Identity.Authentication;

/// <summary>
/// The library side of the checks (ADR 0036, D2). <see cref="FirebaseTokenRules"/> repeats the strict ones
/// with the injected clock; the library reads the system clock, because 8.23.0 has no public TimeProvider here.
/// </summary>
internal static class FirebaseValidationParameters
{
    private static readonly string[] AllowedAlgorithms = [SecurityAlgorithms.RsaSha256];

    public static TokenValidationParameters Create(
        FirebaseProjectOptions project, string keyId, SecurityKey key) => new()
        {
            ValidAlgorithms = AllowedAlgorithms,
            RequireSignedTokens = true,
            TryAllIssuerSigningKeys = false,
            // Only the key of that kid, fetched from the fixed Google URL. jwk, jku and x5u are never read.
            IssuerSigningKeyResolver = (_, _, kid, _) => kid == keyId ? [key] : [],
            ValidateIssuer = true,
            ValidIssuer = project.Issuer,
            ValidateAudience = true,
            ValidAudience = project.ProjectId,
            ValidateLifetime = true,
            RequireExpirationTime = true,
            ClockSkew = FirebaseTokenRules.ClockSkew,
            LogValidationExceptions = false,
            LogTokenId = false,
        };

    /// <summary>Only the exception type is read: its message may carry parts of the token.</summary>
    public static IdTokenRejection RejectionFor(Exception? exception) => exception switch
    {
        SecurityTokenExpiredException => IdTokenRejection.Expired,
        SecurityTokenNotYetValidException => IdTokenRejection.NotYetValid,
        SecurityTokenInvalidAudienceException => IdTokenRejection.WrongAudience,
        SecurityTokenInvalidIssuerException => IdTokenRejection.WrongIssuer,
        SecurityTokenInvalidAlgorithmException => IdTokenRejection.DisallowedAlgorithm,
        SecurityTokenSignatureKeyNotFoundException => IdTokenRejection.UnknownKey,
        SecurityTokenInvalidSignatureException => IdTokenRejection.InvalidSignature,
        SecurityTokenNoExpirationException => IdTokenRejection.MissingTime,
        SecurityTokenMalformedException => IdTokenRejection.Malformed,
        _ => IdTokenRejection.Invalid,
    };
}
