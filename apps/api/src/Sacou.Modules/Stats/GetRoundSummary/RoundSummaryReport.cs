using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Matches.Contracts;
using Sacou.Modules.Stats.Domain.MvpVoting;
using Sacou.Modules.Stats.MvpVoting;
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

/// <summary>Where the MVP of the summary comes from: <c>stats</c> ("Calculado pelo placar") or <c>votes</c> ("Escolhido pela galera").</summary>
internal enum SummaryMvpSource
{
    Stats,
    Votes,
}

/// <summary>
/// The after-game of a round (screens 12, 12a and 12b): only ids and integers, never a level, a grade nor a value of
/// the hidden rating (ADR 0047). <see cref="Modality"/> is the catalog code of the round; <see cref="Ranking"/> only
/// on the sand (null indoors). A round without a stream has <see cref="FinishedMatches"/> 0. <see cref="Mvp"/> and
/// <see cref="MvpVoting"/> are composed on the read (ADR 0072, D10), never stored in the projection.
/// </summary>
internal sealed record RoundSummaryReport(
    Guid RoundId,
    string Modality,
    int MvpFormulaVersion,
    int FinishedMatches,
    SummaryMvpReport? Mvp,
    SummaryMvpVotingReport? MvpVoting,
    SummarySidesReport Sides,
    IReadOnlyList<SummaryPlayerReport> Players,
    IReadOnlyList<SummaryStandingReport>? Ranking)
{
    /// <summary>The after-game with the MVP of the round after its vote (<paramref name="vote"/> null: the round has no vote).</summary>
    public static RoundSummaryReport From(RoundProjection projection, RoundMvpVote? vote)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var summary = projection.Summary;
        return new RoundSummaryReport(
            projection.Facts.RoundId,
            GameModalities.CodeOf(projection.Facts.Summary.Modality),
            summary.MvpFormulaVersion,
            summary.FinishedMatches.Count,
            MvpOf(projection, vote),
            vote is null ? null : new SummaryMvpVotingReport(vote.State, vote.Window.OpensAt, vote.Window.ClosesAt),
            new SummarySidesReport(
                summary.Sides.MostWins is { } wins ? new SummaryMostWinsReport(SideOf(wins.Side), wins.Wins) : null,
                summary.Sides.LongestStreak is { } streak ? new SummaryLongestStreakReport(SideOf(streak.Side), streak.LongestWinStreak) : null),
            [.. summary.Players.Select(SummaryPlayerReport.From)],
            summary.Ranking is { } ranking ? [.. ranking.Select(SummaryStandingReport.From)] : null);
    }

    private static SummaryMvpReport? MvpOf(RoundProjection projection, RoundMvpVote? vote) => FinalMvps.Of(projection, vote) switch
    {
        { Source: MvpSource.Votes } final => SummaryMvpReport.FromVote(final.MemberIds, projection.Summary.Players),
        not null when projection.Summary.Mvp is { } mvp => SummaryMvpReport.From(mvp),
        _ => null,
    };

    public static SummarySide SideOf(CourtSide side) => side == CourtSide.A ? SummarySide.A : SummarySide.B;

    public static SummarySide? SideOf(CourtSide? side) => side is { } known ? SideOf(known) : null;
}

/// <summary>
/// The MVP of the day. By the scoreboard (<see cref="SummaryMvpSource.Stats"/>, question 97): <see cref="MemberIds"/>
/// is one member, or the team of the sand (L1); <see cref="Side"/> is null for a team; on the sand,
/// <see cref="PlusMinus"/> is the team's. By the vote (<see cref="SummaryMvpSource.Votes"/>, ADR 0072, D10): always
/// people (<see cref="SummaryMvpKind.Player"/>), more than one on a shared MVP (then no side), with the numbers of the
/// first winner read now from the after-game: shared winners were tied on balance and wins at the count. Never how
/// many votes.
/// </summary>
internal sealed record SummaryMvpReport(
    SummaryMvpSource Source,
    SummaryMvpKind Kind,
    IReadOnlyList<Guid> MemberIds,
    SummarySide? Side,
    int PlusMinus,
    int Wins,
    int MatchesPlayed,
    int LongestWinStreak)
{
    /// <summary>The winners of the vote; a winner a later correction took out of the after-game has zeros.</summary>
    public static SummaryMvpReport FromVote(IReadOnlyList<Guid> winners, IReadOnlyList<PlayerSummary> players)
    {
        ArgumentNullException.ThrowIfNull(winners);
        ArgumentNullException.ThrowIfNull(players);
        var first = players.FirstOrDefault(player => player.MemberId == winners[0]) ?? NoMatches(winners[0]);
        return new SummaryMvpReport(
            SummaryMvpSource.Votes,
            SummaryMvpKind.Player,
            [.. winners],
            winners.Count == 1 ? RoundSummaryReport.SideOf(first.MainSide) : null,
            first.PlusMinus,
            first.Wins,
            first.MatchesPlayed,
            first.LongestWinStreak);
    }

    private static PlayerSummary NoMatches(Guid memberId) =>
        new(memberId, 0, 0, 0, 0, 0, 0, 0, 0, 0, [], new PointsByKindSummary(0, 0, 0, 0), MainSide: null);

    public static SummaryMvpReport From(MvpSummary mvp) => new(
        SummaryMvpSource.Stats,
        mvp.Kind == MvpKind.Player ? SummaryMvpKind.Player : SummaryMvpKind.Team,
        [.. mvp.MemberIds],
        RoundSummaryReport.SideOf(mvp.Side),
        mvp.PlusMinus,
        mvp.Wins,
        mvp.MatchesPlayed,
        mvp.LongestWinStreak);
}

/// <summary>
/// The notice of the vote on the screen 12 (ADR 0072, D10): the same for every reader, without one's own vote nor a
/// count. Null when the round has no vote (<c>mvp.enabled</c> or <c>mvp.voting</c> off, or a cancelled round).
/// </summary>
internal sealed record SummaryMvpVotingReport(MvpVotingState State, DateTimeOffset OpensAt, DateTimeOffset ClosesAt);

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
