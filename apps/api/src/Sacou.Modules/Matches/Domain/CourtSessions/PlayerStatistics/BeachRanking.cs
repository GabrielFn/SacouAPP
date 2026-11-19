using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;

namespace Sacou.Modules.Matches.Domain.CourtSessions.PlayerStatistics;

/// <summary>Port of <c>stats/beach-ranking.ts</c>: the ranking of the day on the sand (ADR 0048, rule 15 of the statistics).</summary>
internal static class BeachRanking
{
    private const string KeySeparator = " ";

    /// <summary>
    /// Each pair or four that played a finished match, best first: more wins; fewer losses; the longest
    /// run; the best balance of points. A team remade with another partner is another team. Teams that
    /// tie on every criterion keep the order of their first match (<c>a</c>, then <c>b</c>), never the
    /// order of the ids.
    /// </summary>
    public static ImmutableArray<BeachTeamStanding> Of(ImmutableArray<FinishedMatchResult> finishedMatches)
    {
        var teamMatches = finishedMatches.SelectMany(TeamMatchesOf).ToList();
        var standings = teamMatches
            .GroupBy(teamMatch => teamMatch.Key, StringComparer.Ordinal)
            .Select(group => StandingOf([.. group]));
        return [.. standings.OrderBy(standing => standing, Comparer<BeachTeamStanding>.Create(Compare))];
    }

    /// <summary>
    /// The same members in any order are the same team: the ids sorted in ordinal order, as the UTF-16
    /// sort of TypeScript, only to compare, never to show (part 1, condition 2).
    /// </summary>
    public static string TeamKeyOf(ImmutableArray<string> memberIds) =>
        string.Join(KeySeparator, memberIds.Order(StringComparer.Ordinal));

    private static IEnumerable<TeamMatch> TeamMatchesOf(FinishedMatchResult match) =>
        TeamSide.All.Select(side => new TeamMatch(
            TeamKeyOf(match.Teams.Of(side)),
            match.Teams.Of(side),
            StatisticsRules.ResultOfSide(match.Winner, side),
            match.Points.Of(side),
            match.Points.Of(side.Opponent())));

    /// <summary>A team from its matches, the first one giving the order of its members.</summary>
    private static BeachTeamStanding StandingOf(ImmutableArray<TeamMatch> matches)
    {
        ImmutableArray<MatchResult> results = [.. matches.Select(teamMatch => teamMatch.Result)];
        return new BeachTeamStanding(
            matches[0].MemberIds,
            results.Count(result => result == MatchResult.Win),
            results.Count(result => result == MatchResult.Loss),
            results.Count(result => result == MatchResult.Undecided),
            StatisticsRules.GetWinStreaks(results).LongestWinStreak,
            matches.Sum(teamMatch => teamMatch.PointsFor),
            matches.Sum(teamMatch => teamMatch.PointsAgainst));
    }

    private static int Compare(BeachTeamStanding x, BeachTeamStanding y) =>
        Comparisons.FirstDifference(
            y.Wins - x.Wins,
            x.Losses - y.Losses,
            y.LongestWinStreak - x.LongestWinStreak,
            y.PointBalance - x.PointBalance);

    /// <summary>How one match went for a team of the sand.</summary>
    private sealed record TeamMatch(string Key, ImmutableArray<string> MemberIds, MatchResult Result, int PointsFor, int PointsAgainst);
}
