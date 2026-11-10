using System.Security.Cryptography;
using System.Text;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Invites;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Infrastructure.InviteTokens;

/// <summary>
/// SHA-256 of the token's ASCII text, the only form stored. No salt nor pepper: 256 bits of entropy cannot be
/// brute-forced back from the hash, and the unique index needs a deterministic value. The lookup is by hash,
/// so no secret is ever compared in variable time (ADR 0040, D10).
/// </summary>
internal static class InviteTokenHasher
{
    public static InviteTokenHash Hash(string token)
    {
        ArgumentNullException.ThrowIfNull(token);
        return InviteTokenHash.From(SHA256.HashData(Encoding.ASCII.GetBytes(token)));
    }

    /// <summary>A malformed token is <c>groups.invite-invalid</c>, the answer of a dead one, before any query.</summary>
    public static Result<InviteTokenHash> HashIfWellFormed(string? token) =>
        InviteTokenFormat.IsValid(token)
            ? Result.Success(Hash(token))
            : Result.Failure<InviteTokenHash>(GroupErrors.InviteInvalid);
}
