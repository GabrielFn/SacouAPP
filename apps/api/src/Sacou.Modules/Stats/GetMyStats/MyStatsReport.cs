namespace Sacou.Modules.Stats.GetMyStats;

/// <summary>
/// The person's own season (screens 14 and 15): <see cref="Year"/> is the season read (L4), <see cref="Total"/> the
/// sums over every group and <see cref="Groups"/> each group, most matches first, then in the order the person joined
/// (L6). Integers only; the screen computes the percentages. Never a level, a grade nor a value of the rating.
/// </summary>
internal sealed record MyStatsReport(int Year, MyStatsTotalsReport Total, IReadOnlyList<MyStatsGroupReport> Groups);

/// <summary>Presence is <see cref="Rounds"/> over <see cref="RoundsHeld"/> (question 99, L5); "—" with none held.</summary>
internal sealed record MyStatsTotalsReport(
    int MatchesPlayed, int Wins, int Losses, int PlusMinus, int LongestWinStreak, int MvpCount, int Rounds, int RoundsHeld)
{
    public static MyStatsTotalsReport From(SeasonTotals totals)
    {
        ArgumentNullException.ThrowIfNull(totals);
        return new(totals.MatchesPlayed, totals.Wins, totals.Losses, totals.PlusMinus, totals.LongestWinStreak, totals.MvpCount, totals.Rounds, totals.RoundsHeld);
    }
}

/// <summary>One group of the person, with its name and its own modality code (the chip "Quadra 6x6", L6).</summary>
internal sealed record MyStatsGroupReport(
    Guid GroupId,
    string GroupName,
    string Modality,
    int MatchesPlayed,
    int Wins,
    int Losses,
    int PlusMinus,
    int LongestWinStreak,
    int MvpCount,
    int Rounds,
    int RoundsHeld);
