using System.Collections.Immutable;

namespace Sacou.Modules.Sessions.Domain.Draw;

/// <summary>A drawn team: <see cref="Number"/> starts at 1, members in order of arrival, average as the meter shows it.</summary>
internal sealed record DrawnTeam(int Number, ImmutableArray<DrawPlayer> Members, int AverageTenths)
{
    /// <summary>The average comes from private levels: never printed.</summary>
    public override string ToString() => nameof(DrawnTeam);
}

/// <summary>
/// The draw, never stored (ADR 0055). <see cref="TeamSize"/> is the size actually used: 5 when 10 players meet in 6x6.
/// <see cref="Reserves"/> is the queue order. <see cref="DifferenceTenths"/> is the meter of screen 07.
/// </summary>
internal sealed record DrawResult(
    ulong Seed,
    int TeamSize,
    ImmutableArray<DrawnTeam> Teams,
    ImmutableArray<DrawPlayer> Reserves,
    int DifferenceTenths)
{
    public override string ToString() => nameof(DrawResult);
}
