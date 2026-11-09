using System.Collections.Frozen;
using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.Authentication;

/// <summary>
/// Why a token was refused. Logged only as this category, never returned: every refusal is the same
/// 401, so the API is no oracle (ADR 0036, D2).
/// </summary>
internal enum IdTokenRejection
{
    Malformed,
    TooLarge,
    Encrypted,
    DisallowedAlgorithm,
    MissingKeyId,
    UnknownKey,
    SigningKeysUnavailable,
    InvalidSignature,
    WrongAudience,
    WrongIssuer,
    Expired,
    IssuedInTheFuture,
    AuthenticatedInTheFuture,
    NotYetValid,
    MissingTime,
    InvalidSubject,
    DisallowedProvider,
    TenantPresent,
    Invalid,
}

internal static class IdTokenRejections
{
    private const string CodePrefix = "identity.id-token.";

    private static readonly FrozenDictionary<IdTokenRejection, Error> Errors =
        Enum.GetValues<IdTokenRejection>().ToFrozenDictionary(
            rejection => rejection,
            rejection => new Error(CodePrefix + rejection, ErrorKind.Validation));

    private static readonly FrozenDictionary<string, IdTokenRejection> ByCode =
        Errors.ToFrozenDictionary(pair => pair.Value.Code, pair => pair.Key, StringComparer.Ordinal);

    public static Error ToError(this IdTokenRejection rejection) => Errors[rejection];

    public static IdTokenRejection ToRejection(this Error error) =>
        ByCode.TryGetValue(error.Code, out var rejection) ? rejection : IdTokenRejection.Invalid;
}
