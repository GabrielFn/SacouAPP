using Sacou.Modules.Matches.Domain.CourtSessions.Score;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Writes;

/// <summary>
/// The short scoreboard of a stream, stored with each write so the court summary is a one row read with
/// no replay (ADR 0063, D6): the open match, the set it shows, and the points and sets of each team.
/// Only numbers and a match id, never a member id.
/// </summary>
internal sealed record CourtScoreboard(string MatchId, int SetNumber, int PointsA, int PointsB, int SetsA, int SetsB)
{
    /// <summary>
    /// The scoreboard of the open match, on the set in play, or on the last one played while the next
    /// is pending, as the correction list of the app shows it. Null with no open match, which also
    /// covers a match that ended.
    /// </summary>
    public static CourtScoreboard? From(CourtSessionState state)
    {
        ArgumentNullException.ThrowIfNull(state);
        if (state.CurrentMatch is not { } match)
        {
            return null;
        }

        return ShownSet(match) is { } set
            ? new CourtScoreboard(match.MatchId, set.SetNumber, set.Score.A, set.Score.B, match.SetsWon.A, match.SetsWon.B)
            : null;
    }

    private static (int SetNumber, BySide<int> Score)? ShownSet(MatchScore match)
    {
        if (match.CurrentSet is { } current)
        {
            return (current.SetNumber, current.Score);
        }

        return match.CompletedSets.IsEmpty ? null : (match.CompletedSets[^1].SetNumber, match.CompletedSets[^1].Score);
    }

    public override string ToString() => nameof(CourtScoreboard);
}
