using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Queue;

/// <summary>Port of <c>queue/consecutive-matches.ts</c>: counts over the finished matches of the round.</summary>
internal static class MatchHistory
{
    /// <summary>
    /// How many finished matches in a row, ending with the last one, had the member in a team. The
    /// open match does not count, and a <c>RevertedTo</c> undoes the count with the state (ADR 0029).
    /// </summary>
    public static int GetConsecutiveMatches(CourtSessionState state, string memberId) =>
        state.FinishedMatches.Reverse().TakeWhile(finished => HasPlayed(finished, memberId)).Count();

    /// <summary>How many finished matches of the round had the member in a team, in a row or not.</summary>
    public static int GetMatchesPlayed(CourtSessionState state, string memberId) =>
        state.FinishedMatches.Count(finished => HasPlayed(finished, memberId));

    /// <summary>
    /// How many finished matches in a row, ending with the last one, the side won with the same members
    /// as in the last one, in any order (ADR 0050). A loss, a match without a winner or any change of a
    /// member resets it; a manual end with a winner counts.
    /// </summary>
    public static int GetWinStreak(CourtSessionState state, TeamSide side)
    {
        if (state.FinishedMatches.IsEmpty)
        {
            return 0;
        }

        var members = state.FinishedMatches[^1].Match.Teams.Of(side).MemberIds;
        return state.FinishedMatches.Reverse()
            .TakeWhile(finished => finished.Winner == side && IsSameMembers(finished.Match.Teams.Of(side).MemberIds, members))
            .Count();
    }

    private static bool IsSameMembers(ImmutableArray<string> first, ImmutableArray<string> second) =>
        first.Length == second.Length && first.All(memberId => second.Contains(memberId, StringComparer.Ordinal));

    /// <summary>In the team at all, on the bench and as the libero too, and whatever the end or the winner.</summary>
    private static bool HasPlayed(FinishedMatch finished, string memberId) =>
        finished.Match.Teams.A.MemberIds.Contains(memberId, StringComparer.Ordinal)
        || finished.Match.Teams.B.MemberIds.Contains(memberId, StringComparer.Ordinal);
}
