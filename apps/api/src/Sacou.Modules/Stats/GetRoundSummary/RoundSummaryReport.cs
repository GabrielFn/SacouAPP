using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Matches.Contracts;
using Sacou.Modules.Stats.Projections;

namespace Sacou.Modules.Stats.GetRoundSummary;

/// <summary>A side of the court, as the app names it ("a" or "b").</summary>
internal enum SummarySide
{
    A,
    B,
}

/// <summary>One member, or the pair or four of the sand (L1).</summary>
internal enum SummaryMvpKind
{
    Player,
    Team,
}

/// <summary>
/// The after-game of a round (screens 12, 12a and 12b): only ids and integers, never a level, a grade nor a value of
/// the hidden rating (ADR 0047). <see cref="Modality"/> is the catalog code of the round; <see cref="Ranking"/> only
/// on the sand (null indoors). A round without a stream has <see cref="FinishedMatches"/> 0.
/// </summary>
internal sealed record RoundSummaryReport(
    Guid RoundId,
    string Modality,
    int MvpFormulaVersion,
    int FinishedMatches,
    SummaryMvpReport? Mvp,
    SummarySidesReport Sides,
    IReadOnlyList<SummaryPlayerReport> Players,
    IReadOnlyList<SummaryStandingReport>? Ranking)
{
    public static RoundSummaryReport From(RoundProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var summary = projection.Summary;
        return new RoundSummaryReport(
            projection.Facts.RoundId,
            GameModalities.CodeOf(projection.Facts.Summary.Modality),
            summary.MvpFormulaVersion,
            summary.FinishedMatches.Count,
            summary.Mvp is { } mvp ? SummaryMvpReport.From(mvp) : null,
            new SummarySidesReport(
                summary.Sides.MostWins is { } wins ? new SummaryMostWinsReport(SideOf(wins.Side), wins.Wins) : null,
                summary.Sides.LongestStreak is { } streak ? new SummaryLongestStreakReport(SideOf(streak.Side), streak.LongestWinStreak) : null),
            [.. summary.Players.Select(SummaryPlayerReport.From)],
            summary.Ranking is { } ranking ? [.. ranking.Select(SummaryStandingReport.From)] : null);
    }

    public static SummarySide SideOf(CourtSide side) => side == CourtSide.A ? SummarySide.A : SummarySide.B;

    public static SummarySide? SideOf(CourtSide? side) => side is { } known ? SideOf(known) : null;
}

/// <summary>
/// The MVP of the day by the scoreboard (question 97): <see cref="MemberIds"/> is always a list (one member, or the
/// team of the sand, L1); <see cref="Side"/> is null for a team. On the sand, <see cref="PlusMinus"/> is the team's.
/// </summary>
internal sealed record SummaryMvpReport(
    SummaryMvpKind Kind, IReadOnlyList<Guid> MemberIds, SummarySide? Side, int PlusMinus, int Wins, int MatchesPlayed, int LongestWinStreak)
{
    public static SummaryMvpReport From(MvpSummary mvp) => new(
        mvp.Kind == MvpKind.Player ? SummaryMvpKind.Player : SummaryMvpKind.Team,
        [.. mvp.MemberIds],
        RoundSummaryReport.SideOf(mvp.Side),
        mvp.PlusMinus,
        mvp.Wins,
        mvp.MatchesPlayed,
        mvp.LongestWinStreak);
}

/// <summary>"Time que mais venceu" and "Maior sequência" (L3): each null on a tie, and then the card is not shown.</summary>
internal sealed record SummarySidesReport(SummaryMostWinsReport? MostWins, SummaryLongestStreakReport? LongestStreak);

internal sealed record SummaryMostWinsReport(SummarySide Side, int Wins);

internal sealed record SummaryLongestStreakReport(SummarySide Side, int LongestWinStreak);

/// <summary>The round of one member: <see cref="PointsByKind"/> is all zero with "Ponto individual" off (rule 3.5).</summary>
internal sealed record SummaryPlayerReport(
    Guid MemberId,
    int MatchesPlayed,
    int Wins,
    int Losses,
    int Undecided,
    int PlusMinus,
    int LongestWinStreak,
    SummaryPointsByKindReport PointsByKind,
    SummarySide? MainSide)
{
    public static SummaryPlayerReport From(PlayerSummary player) => new(
        player.MemberId,
        player.MatchesPlayed,
        player.Wins,
        player.Losses,
        player.Undecided,
        player.PlusMinus,
        player.LongestWinStreak,
        new SummaryPointsByKindReport(player.PointsByKind.Attack, player.PointsByKind.Block, player.PointsByKind.Ace, player.PointsByKind.Other),
        RoundSummaryReport.SideOf(player.MainSide));
}

internal sealed record SummaryPointsByKindReport(int Attack, int Block, int Ace, int Other);

/// <summary>A pair or a four on the ranking of the day of the sand (ADR 0048); <see cref="Undecided"/> is L7.</summary>
internal sealed record SummaryStandingReport(
    IReadOnlyList<Guid> MemberIds, int Wins, int Losses, int Undecided, int LongestWinStreak, int PointsFor, int PointsAgainst)
{
    public static SummaryStandingReport From(TeamStandingSummary standing) => new(
        [.. standing.MemberIds], standing.Wins, standing.Losses, standing.Undecided, standing.LongestWinStreak, standing.PointsFor, standing.PointsAgainst);
}
