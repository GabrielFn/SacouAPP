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

    /// <summary>In the team at all, on the bench and as the libero too, and whatever the end or the winner.</summary>
    private static bool HasPlayed(FinishedMatch finished, string memberId) =>
        finished.Match.Teams.A.MemberIds.Contains(memberId, StringComparer.Ordinal)
        || finished.Match.Teams.B.MemberIds.Contains(memberId, StringComparer.Ordinal);
}
