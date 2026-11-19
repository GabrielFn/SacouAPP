using System.Buffers.Text;
using System.Security.Cryptography;
using Sacou.Modules.Sessions.Domain.Rounds;

namespace Sacou.Modules.Sessions.Infrastructure;

/// <summary>
/// 16 bytes from the operating system's CSPRNG (128 bits), in Base64url without padding: 22 characters. Never a
/// <see cref="Guid"/>, never <see cref="Random"/>, never derived from the round id, which is a UUID v7 and tells its instant.
/// </summary>
internal sealed class RandomRoundLinkCodeGenerator : IRoundLinkCodeGenerator
{
    public const int CodeBytes = 16;

    public RoundLinkCode NewCode() =>
        RoundLinkCode.TryParse(Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(CodeBytes)))
        ?? throw new InvalidOperationException("16 random bytes always make a well-formed code.");
}
