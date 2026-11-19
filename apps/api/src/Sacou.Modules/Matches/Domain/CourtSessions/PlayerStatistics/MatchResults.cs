using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;

namespace Sacou.Modules.Matches.Domain.CourtSessions.PlayerStatistics;

/// <summary>Port of <c>stats/match-results.ts</c> (<c>getMatchResults</c>), rule 10 of the statistics.</summary>
internal static class MatchResults
{
    /// <summary>
    /// Each finished match of the court session, in the order of the <c>MatchEnded</c>: the winner, the
    /// teams as started, who of them played at least one active rally (with the rotation off, the whole
    /// team) and the rallies each side won. The open match is not here; a match ended by hand without a
    /// rally has nobody on the court.
    /// </summary>
    public static ImmutableArray<FinishedMatchResult> Of(
        ImmutableArray<FinishedMatch> finishedMatches,
        ImmutableArray<PlayedRally> rallies)
    {
        var ralliesByMatch = MatchTallies.RalliesByMatch(rallies);
        return [.. finishedMatches.Select(finished =>
        {
            var match = finished.Match;
            var played = ralliesByMatch.GetValueOrDefault(match.MatchId, []);
            return new FinishedMatchResult(
                match.MatchId,
                finished.Winner,
                new BySide<ImmutableArray<string>>(match.Teams.A.MemberIds, match.Teams.B.MemberIds),
                new BySide<ImmutableArray<string>>(OnCourtOf(match.Teams.A.MemberIds, played, TeamSide.A), OnCourtOf(match.Teams.B.MemberIds, played, TeamSide.B)),
                new BySide<int>(PointsOf(played, TeamSide.A), PointsOf(played, TeamSide.B)));
        })];
    }

    /// <summary>The members of the team who stood on the court in one of the rallies, in the order of the team.</summary>
    private static ImmutableArray<string> OnCourtOf(ImmutableArray<string> team, ImmutableArray<PlayedRally> rallies, TeamSide side)
    {
        var rallied = rallies.SelectMany(rally => rally.OnCourt.Of(side)).ToHashSet(StringComparer.Ordinal);
        return [.. team.Where(rallied.Contains)];
    }

    private static int PointsOf(ImmutableArray<PlayedRally> rallies, TeamSide side) => rallies.Count(rally => rally.Team == side);
}
