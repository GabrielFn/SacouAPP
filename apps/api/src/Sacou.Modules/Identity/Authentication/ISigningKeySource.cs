using Microsoft.IdentityModel.Tokens;

namespace Sacou.Modules.Identity.Authentication;

/// <summary>The public keys that sign ID tokens, by <c>kid</c>. Swapped for a fake in unit tests.</summary>
internal interface ISigningKeySource
{
    Task<SigningKeyLookup> FindAsync(string keyId, CancellationToken cancellationToken);
}

internal enum SigningKeyStatus
{
    Found,
    Unknown,
    Unavailable,
}

/// <summary><see cref="Key"/> is set only when <see cref="Status"/> is <see cref="SigningKeyStatus.Found"/>.</summary>
internal sealed record SigningKeyLookup(SigningKeyStatus Status, SecurityKey? Key)
{
    public static readonly SigningKeyLookup Unknown = new(SigningKeyStatus.Unknown, null);

    public static readonly SigningKeyLookup Unavailable = new(SigningKeyStatus.Unavailable, null);

    public static SigningKeyLookup Found(SecurityKey key) => new(SigningKeyStatus.Found, key);
}
