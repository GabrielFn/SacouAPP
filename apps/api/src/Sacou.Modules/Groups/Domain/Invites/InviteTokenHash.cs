using System.Collections.Immutable;

namespace Sacou.Modules.Groups.Domain.Invites;

/// <summary>
/// The SHA-256 of an invite token, the only form the database keeps (ADR 0040, D10). The domain never sees
/// the token nor computes the hash: both live in the Infrastructure, which may use cryptography.
/// </summary>
internal sealed record InviteTokenHash
{
    public const int Length = 32;

    private InviteTokenHash(ImmutableArray<byte> bytes) => Bytes = bytes;

    public ImmutableArray<byte> Bytes { get; }

    public static InviteTokenHash From(ReadOnlySpan<byte> bytes) =>
        bytes.Length == Length
            ? new InviteTokenHash([.. bytes])
            : throw new ArgumentException($"An invite token hash has {Length} bytes.", nameof(bytes));

    public bool Equals(InviteTokenHash? other) => other is not null && Bytes.AsSpan().SequenceEqual(other.Bytes.AsSpan());

    public override int GetHashCode() => BitConverter.ToInt32(Bytes.AsSpan()[..sizeof(int)]);

    /// <summary>Never print the hash: with it, a log line would find the invite.</summary>
    public override string ToString() => nameof(InviteTokenHash);
}
