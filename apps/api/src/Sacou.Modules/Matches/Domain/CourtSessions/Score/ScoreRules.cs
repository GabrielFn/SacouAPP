using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score;

/// <summary>
/// <c>TieBreakPoints</c> <c>null</c> turns the tie-break off. <c>WinMargin</c> 2 means advantage and 1
/// means none; it also applies to the tie-break.
/// </summary>
internal sealed record ScoringRules(int BestOf, int PointsPerSet, int? TieBreakPoints, int WinMargin);

/// <summary>Port of <c>score/scoring-rules.ts</c>. Scores and set numbers are <c>int</c> (ADR 0033, D5).</summary>
internal static class ScoreRules
{
    /// <summary>Half of the sets, rounded up, wins the match.</summary>
    public const int MajorityDivisor = 2;

    private const int SingleSet = 1;
    private const int OnePoint = 1;

    /// <summary>The tie-break is only the deciding set of a series: a single set uses <c>PointsPerSet</c>.</summary>
    public static int TargetPointsForSet(ScoringRules rules, int setNumber)
    {
        var isDecidingSet = rules.BestOf > SingleSet && setNumber == rules.BestOf;
        return isDecidingSet && rules.TieBreakPoints is { } tieBreakPoints ? tieBreakPoints : rules.PointsPerSet;
    }

    public static int SetsToWin(int bestOf) => (int)Math.Ceiling(bestOf / (double)MajorityDivisor);

    /// <summary>Only detects: a set ends when its end is confirmed, never by the rule alone.</summary>
    public static TeamSide? GetSetWinner(BySide<int> score, int targetPoints, int winMargin)
    {
        var leader = score.A >= score.B ? TeamSide.A : TeamSide.B;
        var trailer = leader.Opponent();
        var hasWon = score.Of(leader) >= targetPoints && score.Of(leader) - score.Of(trailer) >= winMargin;
        return hasWon ? leader : null;
    }

    /// <summary>A list, because without advantage both teams can have set point. Empty once decided.</summary>
    public static ImmutableArray<TeamSide> GetSetPointTeams(BySide<int> score, int targetPoints, int winMargin)
    {
        if (GetSetWinner(score, targetPoints, winMargin) is not null)
        {
            return [];
        }

        return
        [
            .. TeamSide.All.Where(team =>
                GetSetWinner(score.With(team, score.Of(team) + OnePoint), targetPoints, winMargin) == team),
        ];
    }

    public static TeamSide? GetMatchWinner(BySide<int> setsWon, int bestOf)
    {
        var needed = SetsToWin(bestOf);
        return TeamSide.All.FirstOrDefault(team => setsWon.Of(team) >= needed);
    }
}
