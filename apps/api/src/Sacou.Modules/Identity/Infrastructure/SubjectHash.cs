using System.Security.Cryptography;
using System.Text;
using Sacou.Modules.Identity.Domain.Users;

namespace Sacou.Modules.Identity.Infrastructure;

/// <summary>
/// SHA-256 of the Firebase UID in UTF-8: the key of <c>identity.deleted_accounts</c> (ADR 0056, D5). No salt: the UID
/// carries about 160 random bits, so the hash is neither reversed nor guessed from a list, and the lookup must be
/// deterministic (the same reasoning as the invite token, ADR 0040, D10).
/// </summary>
internal sealed class SubjectHash
{
    public const int Length = 32;

    private readonly byte[] value;

    private SubjectHash(byte[] value) => this.value = value;

    public static SubjectHash Of(AuthSubject subject)
    {
        ArgumentNullException.ThrowIfNull(subject);
        return new SubjectHash(SHA256.HashData(Encoding.UTF8.GetBytes(subject.Value)));
    }

    /// <summary>A copy of the 32 bytes, for a query parameter.</summary>
    public byte[] ToArray() => (byte[])value.Clone();

    public bool Matches(SubjectHash other) => other is not null && CryptographicOperations.FixedTimeEquals(value, other.value);

    /// <summary>Never print the hash: it stands for one person.</summary>
    public override string ToString() => nameof(SubjectHash);
}
