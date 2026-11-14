using System.Buffers.Binary;
using System.Security.Cryptography;

namespace Sacou.Modules.Sessions.DrawTeams;

/// <summary>Where the seed of each draw comes from. The domain only receives it (ADR 0055).</summary>
internal interface IDrawSeeds
{
    ulong Next();
}

/// <summary>A cryptographic seed, so one draw tells nothing about the next.</summary>
internal sealed class RandomDrawSeeds : IDrawSeeds
{
    public ulong Next() => BinaryPrimitives.ReadUInt64LittleEndian(RandomNumberGenerator.GetBytes(sizeof(ulong)));
}
