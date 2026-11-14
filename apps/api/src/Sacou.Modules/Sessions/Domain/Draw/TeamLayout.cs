using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Domain.Draw;

/// <summary>
/// How many teams, of what size, and how many reserves (docs/dominio/sorteio.md, questions 52 and 53). As many
/// full teams as fit; with fewer than two, two teams of half the players. Every team has the same size.
/// </summary>
internal sealed record TeamLayout(int TeamCount, int TeamSize, int ReserveCount)
{
    public int PlayingCount => TeamCount * TeamSize;

    public static Result<TeamLayout> For(int playerCount, int playersPerTeam)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(playersPerTeam);
        if (playerCount < DrawLimits.MinPlayers)
        {
            return Result.Failure<TeamLayout>(DrawErrors.NotEnoughPlayers);
        }

        var fullTeams = playerCount / playersPerTeam;
        var layout = fullTeams >= DrawLimits.MinTeams
            ? new TeamLayout(fullTeams, playersPerTeam, playerCount - (fullTeams * playersPerTeam))
            : HalvesOf(playerCount);
        return Result.Success(layout);
    }

    private static TeamLayout HalvesOf(int playerCount)
    {
        var teamSize = playerCount / DrawLimits.MinTeams;
        return new TeamLayout(DrawLimits.MinTeams, teamSize, playerCount - (DrawLimits.MinTeams * teamSize));
    }
}
