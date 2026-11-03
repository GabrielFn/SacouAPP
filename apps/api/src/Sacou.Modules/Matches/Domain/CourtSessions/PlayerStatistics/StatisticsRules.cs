using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;

namespace Sacou.Modules.Matches.Domain.CourtSessions.PlayerStatistics;

/// <summary>
/// Port of <c>stats/player-stats.ts</c>, <c>stats/side-stats.ts</c> and <c>stats/match-results.ts</c>.
/// Computed from the timeline alone, never recorded; the open match counts nothing until it ends
/// (ADR 0032). Where E3.9 consumes it from <c>Stats</c> is for that task.
/// </summary>
internal static class StatisticsRules
{
    /// <summary>
    /// The statistics of each member who played a finished match, in the order they first appear:
    /// <c>teams.a</c>, then <c>teams.b</c>, match by match. Never ordered by member id.
    /// </summary>
    public static ImmutableArray<PlayerStats> GetPlayerStats(ReplayedTimeline<CourtSessionState> timeline)
    {
        var finishedMatches = FinishedMatchesOf(timeline);
        var balancesByMatch = MatchTallies.CourtBalancesByMatch(timeline);
        var pointsByMatch = MatchTallies.PointsByMatch(timeline);
        ImmutableArray<MatchTally> tallies =
        [
            .. finishedMatches.Select(finished => new MatchTally(
                ResultsOfMatch(finished),
                balancesByMatch.GetValueOrDefault(finished.Match.MatchId, ImmutableDictionary<string, CourtBalance>.Empty),
                pointsByMatch.GetValueOrDefault(finished.Match.MatchId, ImmutableDictionary<string, PointsByKind>.Empty))),
        ];
        return [.. MembersInOrder(finishedMatches).Select(memberId => ToPlayerStats(memberId, SharesOf(memberId, tallies)))];
    }

    /// <summary>A side of the court is a team, whoever plays on it after a partial exit (ADR 0032, P3).</summary>
    public static BySide<SideStats> GetSideStats(ReplayedTimeline<CourtSessionState> timeline)
    {
        var finishedMatches = FinishedMatchesOf(timeline);
        return new BySide<SideStats>(SideStatsOf(finishedMatches, TeamSide.A), SideStatsOf(finishedMatches, TeamSide.B));
    }

    /// <summary>A match without a winner is neither a win nor a loss for anyone (ADR 0032, P2).</summary>
    public static MatchResult ResultOfSide(FinishedMatch finished, TeamSide side) =>
        finished.Winner is null ? MatchResult.Undecided
        : finished.Winner == side ? MatchResult.Win
        : MatchResult.Loss;

    /// <summary>A loss and a match without a winner both break the run; the current run ends with the last result.</summary>
    public static WinStreaks GetWinStreaks(IEnumerable<MatchResult> results) =>
        results.Aggregate(WinStreaks.None, (streaks, result) =>
        {
            const int OneWin = 1;
            var current = result == MatchResult.Win ? streaks.CurrentWinStreak + OneWin : 0;
            return new WinStreaks(Math.Max(streaks.LongestWinStreak, current), current);
        });

    /// <summary>The last state of the timeline, as <c>entries.at(-1)</c>: an empty timeline has no finished match.</summary>
    private static ImmutableArray<FinishedMatch> FinishedMatchesOf(ReplayedTimeline<CourtSessionState> timeline) =>
        timeline.Entries.IsEmpty ? [] : timeline.Entries[^1].State.FinishedMatches;

    private static SideStats SideStatsOf(ImmutableArray<FinishedMatch> finishedMatches, TeamSide side)
    {
        ImmutableArray<MatchResult> results = [.. finishedMatches.Select(finished => ResultOfSide(finished, side))];
        var streaks = GetWinStreaks(results);
        return new SideStats(results.Count(result => result == MatchResult.Win), streaks.LongestWinStreak, streaks.CurrentWinStreak);
    }

    /// <summary>Everyone of a team, the bench and the libero too; a later entry of a member replaces the earlier one.</summary>
    private static ImmutableDictionary<string, MatchResult> ResultsOfMatch(FinishedMatch finished) =>
        TeamSide.All
            .SelectMany(side => finished.Match.Teams.Of(side).MemberIds.Select(memberId => (memberId, Result: ResultOfSide(finished, side))))
            .Aggregate(
                ImmutableDictionary.Create<string, MatchResult>(StringComparer.Ordinal),
                (results, played) => results.SetItem(played.memberId, played.Result));

    private static ImmutableArray<string> MembersInOrder(ImmutableArray<FinishedMatch> finishedMatches) =>
        [.. finishedMatches
            .SelectMany(finished => finished.Match.Teams.A.MemberIds.Concat(finished.Match.Teams.B.MemberIds))
            .Distinct(StringComparer.Ordinal)];

    private static ImmutableArray<MatchShare> SharesOf(string memberId, ImmutableArray<MatchTally> tallies) =>
        [.. tallies
            .Where(tally => tally.Results.ContainsKey(memberId))
            .Select(tally => new MatchShare(
                tally.Results[memberId],
                tally.Balances.GetValueOrDefault(memberId, CourtBalance.None),
                tally.Points.GetValueOrDefault(memberId, PointsByKind.None)))];

    private static PlayerStats ToPlayerStats(string memberId, ImmutableArray<MatchShare> shares)
    {
        ImmutableArray<MatchResult> results = [.. shares.Select(share => share.Result)];
        var pointsFor = shares.Sum(share => share.Balance.PointsFor);
        var pointsAgainst = shares.Sum(share => share.Balance.PointsAgainst);
        var streaks = GetWinStreaks(results);
        return new PlayerStats(
            memberId,
            results.Length,
            results.Count(result => result == MatchResult.Win),
            results.Count(result => result == MatchResult.Loss),
            results.Count(result => result == MatchResult.Undecided),
            pointsFor,
            pointsAgainst,
            pointsFor - pointsAgainst,
            streaks.LongestWinStreak,
            streaks.CurrentWinStreak,
            results,
            shares.Aggregate(PointsByKind.None, (total, share) => total.Add(share.Points)));
    }

    /// <summary>What a finished match gave each member who played it.</summary>
    private sealed record MatchTally(
        ImmutableDictionary<string, MatchResult> Results,
        ImmutableDictionary<string, CourtBalance> Balances,
        ImmutableDictionary<string, PointsByKind> Points);

    /// <summary>A member's share of one match: the result, the court balance and the points scored.</summary>
    private sealed record MatchShare(MatchResult Result, CourtBalance Balance, PointsByKind Points);
}
