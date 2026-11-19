using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;

namespace Sacou.Modules.Matches.Domain.CourtSessions.PlayerStatistics;

/// <summary>Port of <c>stats/mvp.ts</c>: the MVP of the day from the scoreboard, formula 1 (question 97, rules 11 to 13).</summary>
internal static class MvpByStats
{
    /// <summary>Version of the rule; it goes with every summary, and changing the rule bumps it (E3.9).</summary>
    public const int FormulaVersion = 1;

    /// <summary>The MVP of the court: the best player by formula 1, on the side they played the most.</summary>
    public static DayMvp? OfPlayers(ImmutableArray<PlayerStats> players, ImmutableArray<FinishedMatchResult> finishedMatches)
    {
        var best = Comparisons.FirstOf(players.Where(player => player.MatchesPlayed > 0), CompareCandidates);
        return best is null
            ? null
            : new DayMvp(
                MvpKind.Player,
                [best.MemberId],
                MainSideOf(best.MemberId, finishedMatches),
                best.MatchesPlayed,
                best.Wins,
                best.PlusMinus,
                best.LongestWinStreak);
    }

    /// <summary>The MVP of the sand: the pair or the four first on the ranking of the day, without a side.</summary>
    public static DayMvp? OfTeams(ImmutableArray<BeachTeamStanding> ranking)
    {
        if (ranking.IsEmpty)
        {
            return null;
        }

        var first = ranking[0];
        return new DayMvp(
            MvpKind.Team,
            first.MemberIds,
            Side: null,
            first.Wins + first.Losses + first.Undecided,
            first.Wins,
            first.PointBalance,
            first.LongestWinStreak);
    }

    /// <summary>The side the member played the most matches on; on a tie, the side of their last match.</summary>
    public static TeamSide? MainSideOf(string memberId, ImmutableArray<FinishedMatchResult> finishedMatches)
    {
        ImmutableArray<TeamSide> sides = [.. finishedMatches.SelectMany(match => SideOf(memberId, match))];
        var onA = sides.Count(side => side == TeamSide.A);
        var onB = sides.Length - onA;
        if (onA == onB)
        {
            return sides.IsEmpty ? null : sides[^1];
        }

        return onA > onB ? TeamSide.A : TeamSide.B;
    }

    /// <summary>
    /// The best balance; then the best share of wins, compared as integers (<c>w1 × m2</c> against
    /// <c>w2 × m1</c>, so 2 of 3 ties with 4 of 6); then the longest run; then more matches. A full tie
    /// keeps the order of the first appearance, never the ids.
    /// </summary>
    private static int CompareCandidates(PlayerStats x, PlayerStats y) =>
        Comparisons.FirstDifference(
            y.PlusMinus - x.PlusMinus,
            (y.Wins * x.MatchesPlayed) - (x.Wins * y.MatchesPlayed),
            y.LongestWinStreak - x.LongestWinStreak,
            y.MatchesPlayed - x.MatchesPlayed);

    private static IEnumerable<TeamSide> SideOf(string memberId, FinishedMatchResult match)
    {
        if (match.Teams.A.Contains(memberId, StringComparer.Ordinal))
        {
            return [TeamSide.A];
        }

        return match.Teams.B.Contains(memberId, StringComparer.Ordinal) ? [TeamSide.B] : [];
    }
}
