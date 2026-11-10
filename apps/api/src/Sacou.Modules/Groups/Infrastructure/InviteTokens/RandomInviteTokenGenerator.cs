using System.Buffers.Text;
using System.Security.Cryptography;

namespace Sacou.Modules.Groups.Infrastructure.InviteTokens;

/// <summary>
/// 32 bytes from the operating system's CSPRNG (256 bits), in Base64url without padding: 43 characters
/// (ADR 0040, D10). Never a <see cref="Guid"/>, never <see cref="Random"/>, never derived from an id.
/// </summary>
internal sealed class RandomInviteTokenGenerator : IInviteTokenGenerator
{
    public const int TokenBytes = 32;

    public string NewToken() => Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(TokenBytes));
}
