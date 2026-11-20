using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;

namespace Sacou.Modules.Matches.Domain.CourtSessions.PlayerStatistics;

/// <summary>Port of <c>stats/round-summary.ts</c> and <c>stats/side-highlights.ts</c> (E3.9, ADR 0071).</summary>
internal static class RoundSummaryRules
{
    /// <summary>
    /// The after-game of a court session, computed from the timeline and the options of the round, never
    /// recorded: the finished matches, the statistics of each member, the highlights by side, the MVP of
    /// the day from the scoreboard and, on the sand only, the ranking of the day. The open match counts
    /// nothing. The rallies are worked out once and shared (part 1, condition 1).
    /// </summary>
    public static RoundSummary GetRoundSummary(ReplayedTimeline<CourtSessionState> timeline, RoundSummaryOptions options)
    {
        var rallies = MatchTallies.PlayedRallies(timeline);
        var finishedMatches = MatchResults.Of(StatisticsRules.FinishedMatchesOf(timeline), rallies);
        var players = PlayersOf(StatisticsRules.GetPlayerStats(timeline, rallies), options.IndividualPoints);
        ImmutableArray<BeachTeamStanding>? ranking = options.Modality.IsBeach ? BeachRanking.Of(finishedMatches) : null;
        return new RoundSummary(
            MvpByStats.FormulaVersion,
            finishedMatches,
            players,
            HighlightsOf(StatisticsRules.GetSideStats(timeline)),
            MvpOf(options, players, finishedMatches, ranking),
            ranking);
    }

    /// <summary>
    /// "Time que mais venceu" and "Maior sequência" of screen 12: the side ahead, or <c>null</c> on a tie,
    /// so the screen hides the card.
    /// </summary>
    public static SideHighlights HighlightsOf(BySide<SideStats> sides)
    {
        var (a, b) = (sides.A, sides.B);
        return new SideHighlights(
            a.Wins == b.Wins ? null : new MostWinsHighlight(a.Wins > b.Wins ? TeamSide.A : TeamSide.B, Math.Max(a.Wins, b.Wins)),
            a.LongestWinStreak == b.LongestWinStreak
                ? null
                : new LongestStreakHighlight(
                    a.LongestWinStreak > b.LongestWinStreak ? TeamSide.A : TeamSide.B,
                    Math.Max(a.LongestWinStreak, b.LongestWinStreak)));
    }

    /// <summary>
    /// With "pontos individuais" off the attributions still arrive (the server never refuses them, the
    /// option may change during the round), but they credit nobody (E3.9, 3.5).
    /// </summary>
    private static ImmutableArray<PlayerStats> PlayersOf(ImmutableArray<PlayerStats> players, bool individualPoints) =>
        individualPoints ? players : [.. players.Select(player => player with { PointsByKind = PointsByKind.None })];

    private static DayMvp? MvpOf(
        RoundSummaryOptions options,
        ImmutableArray<PlayerStats> players,
        ImmutableArray<FinishedMatchResult> finishedMatches,
        ImmutableArray<BeachTeamStanding>? ranking)
    {
        if (!options.MvpEnabled || !options.MvpByStats)
        {
            return null;
        }

        return ranking is { } standings ? MvpByStats.OfTeams(standings) : MvpByStats.OfPlayers(players, finishedMatches);
    }
}
