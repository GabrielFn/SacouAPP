namespace Sacou.Modules.Sessions.Domain.Draw;

/// <summary>The numbers of the draw (docs/dominio/sorteio.md, ADR 0055).</summary>
internal static class DrawLimits
{
    /// <summary>Two teams of two.</summary>
    public const int MinPlayers = 4;

    public const int MinTeams = 2;

    /// <summary>Far above what a racha needs, and keeps the search for a valid split small.</summary>
    public const int MaxLocks = 24;

    /// <summary>Up to here, two teams are split by trying every division (at most 6.435, with 16 players).</summary>
    public const int MaxPlayersForExactSplit = 16;

    /// <summary>Starts of the local search when the exact split would be too long.</summary>
    public const int SearchRestarts = 64;
}
