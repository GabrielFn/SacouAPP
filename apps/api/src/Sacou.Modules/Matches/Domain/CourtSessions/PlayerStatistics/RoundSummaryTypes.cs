using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;

namespace Sacou.Modules.Matches.Domain.CourtSessions.PlayerStatistics;

/// <summary>
/// A finished match as the projections and the rating need it (E3.9, rule 10 of the statistics): the
/// teams as in the <c>MatchStarted</c>, who of them stood on the court in at least one active rally (the
/// bench that never came in is only in <c>Teams</c>), and the rallies each side won. Key order of the
/// contract with TypeScript.
/// </summary>
internal sealed record FinishedMatchResult(
    string MatchId,
    TeamSide? Winner,
    BySide<ImmutableArray<string>> Teams,
    BySide<ImmutableArray<string>> OnCourt,
    BySide<int> Points);

/// <summary>The <c>format.modality</c> of the round (<c>docs/dominio/configuracao.md</c>): the sand ranks the pairs or the fours (ADR 0048).</summary>
internal sealed record RoundModality
{
    public static readonly RoundModality Indoor6x6 = new("indoor-6x6", isBeach: false);
    public static readonly RoundModality Beach2x2 = new("beach-2x2", isBeach: true);
    public static readonly RoundModality Beach4x4 = new("beach-4x4", isBeach: true);

    public static readonly ImmutableArray<RoundModality> All = [Indoor6x6, Beach2x2, Beach4x4];

    private RoundModality(string code, bool isBeach)
    {
        Code = code;
        IsBeach = isBeach;
    }

    public string Code { get; }

    public bool IsBeach { get; }

    /// <summary>The modality of a code of the catalog, or <c>null</c> for any other text.</summary>
    public static RoundModality? FromCode(string code) =>
        All.FirstOrDefault(modality => string.Equals(modality.Code, code, StringComparison.Ordinal));
}

/// <summary>The options of the round that change its summary, from the resolved settings (E3.9).</summary>
internal sealed record RoundSummaryOptions(RoundModality Modality, bool MvpEnabled, bool MvpByStats, bool IndividualPoints);

/// <summary>"Time que mais venceu" of screen 12: the side with more wins.</summary>
internal sealed record MostWinsHighlight(TeamSide Side, int Wins);

/// <summary>"Maior sequência" of screen 12: the side with the longest run of wins.</summary>
internal sealed record LongestStreakHighlight(TeamSide Side, int LongestWinStreak);

/// <summary>Each highlight is <c>null</c> on a tie, and the screen hides the card.</summary>
internal sealed record SideHighlights(MostWinsHighlight? MostWins, LongestStreakHighlight? LongestStreak);

/// <summary>
/// A pair or a four of the sand on the ranking of the day (ADR 0048): the same members, in any order,
/// are the same team. Members in the order of the first match of the team.
/// </summary>
internal sealed record BeachTeamStanding(
    ImmutableArray<string> MemberIds,
    int Wins,
    int Losses,
    int Undecided,
    int LongestWinStreak,
    int PointsFor,
    int PointsAgainst)
{
    public int PointBalance => PointsFor - PointsAgainst;
}

/// <summary>Who the MVP of the day is: one member, or a pair or four of the sand (E3.18, L1).</summary>
internal sealed record MvpKind
{
    public static readonly MvpKind Player = new("player");
    public static readonly MvpKind Team = new("team");

    private MvpKind(string code) => Code = code;

    public string Code { get; }
}

/// <summary>
/// The MVP of the day from the scoreboard (question 97). On the court, one member and the side they
/// played the most; on the sand, the team first on the ranking, without a side, and
/// <c>PlusMinus</c> is the balance of its points.
/// </summary>
internal sealed record DayMvp(
    MvpKind Kind,
    ImmutableArray<string> MemberIds,
    TeamSide? Side,
    int MatchesPlayed,
    int Wins,
    int PlusMinus,
    int LongestWinStreak);

/// <summary>The after-game of a court session (E3.9): screens 12, 12b, 14 and 15 read it. <c>Ranking</c> only on the sand.</summary>
internal sealed record RoundSummary(
    int MvpFormulaVersion,
    ImmutableArray<FinishedMatchResult> FinishedMatches,
    ImmutableArray<PlayerStats> Players,
    SideHighlights Sides,
    DayMvp? Mvp,
    ImmutableArray<BeachTeamStanding>? Ranking);
