using System.Collections.Immutable;
using Sacou.Shared.Members;

namespace Sacou.Modules.Sessions.Domain.Draw;

/// <summary>
/// A confirmed player of the round. <see cref="LevelTenths"/> is the resolved level (admin note, suggestion or 3,0,
/// ADR 0047): private, it never leaves the server but to an Admin or a Co-admin. <see cref="Sequence"/> is the order
/// of arrival in the round.
/// </summary>
internal sealed record DrawPlayer(MemberId MemberId, int LevelTenths, int Sequence)
{
    /// <summary>The level is private: never printed, not even in a test failure or a log.</summary>
    public override string ToString() => nameof(DrawPlayer);
}

/// <summary>
/// Everything a draw needs. <see cref="Reserves"/> null means "the last ones to arrive" (docs/dominio/sorteio.md);
/// a list is the order of the reserve queue after a "Trocar". <see cref="BalanceByLevel"/> false is the quick draw:
/// random, still within the locks.
/// </summary>
internal sealed record DrawInput(
    ImmutableArray<DrawPlayer> Players,
    int PlayersPerTeam,
    ImmutableArray<DrawLock> Locks,
    ImmutableArray<MemberId>? Reserves,
    bool BalanceByLevel,
    ulong Seed)
{
    public override string ToString() => nameof(DrawInput);
}
