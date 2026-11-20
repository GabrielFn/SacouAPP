using Sacou.Modules.Groups.Contracts;

namespace Sacou.Modules.Matches.Contracts;

/// <summary>
/// The after-game of the court streams, for the Stats (E3.9, ADR 0071): computed here, by the replay of the stored
/// stream, so no other module reads <c>court_events</c> nor the rules of the statistics. Only ids and integers; a
/// stream is always found by <c>(groupId, roundId)</c>.
/// </summary>
public interface ICourtSessionResults
{
    /// <summary>The stream of the round in the group and its event count; null when the round has none.</summary>
    Task<CourtStreamHead?> FindOfRoundAsync(Guid groupId, Guid roundId, CancellationToken cancellationToken);

    /// <summary>Every stream of the group with its event count, by round id.</summary>
    Task<IReadOnlyList<CourtStreamHead>> ListOfGroupAsync(Guid groupId, CancellationToken cancellationToken);

    /// <summary>
    /// The summary of the stored stream with the summary leaves of its round, and the count of events it was
    /// computed from. A stream with no event is an empty summary. Never stored here.
    /// </summary>
    Task<CourtSessionResults> SummarizeAsync(CourtStreamHead stream, SummaryRules rules, CancellationToken cancellationToken);
}

/// <summary>A stream of a round and how many events it has: with the round's facts, the key of a fresh projection.</summary>
public sealed record CourtStreamHead(Guid RoundId, Guid CourtSessionId, int EventCount);

/// <summary>The summary of a stream and the count of events it read (the stream may grow between the head and the read).</summary>
public sealed record CourtSessionResults(int EventCount, SessionSummary Summary);

/// <summary>A side of the court.</summary>
public enum CourtSide
{
    A,
    B,
}

/// <summary>How a finished match went for a member: without a winner it is neither (ADR 0032).</summary>
public enum MatchOutcome
{
    Win,
    Loss,
    Undecided,
}

/// <summary>The after-game of a court session (screens 12, 12b, 14 and 15). <see cref="Ranking"/> only on the sand.</summary>
public sealed record SessionSummary(
    int MvpFormulaVersion,
    IReadOnlyList<FinishedMatchSummary> FinishedMatches,
    IReadOnlyList<PlayerSummary> Players,
    SideHighlightsSummary Sides,
    MvpSummary? Mvp,
    IReadOnlyList<TeamStandingSummary>? Ranking)
{
    public static readonly SessionSummary Empty = new(0, [], [], new SideHighlightsSummary(null, null), null, null);
}

/// <summary>
/// A finished match: the teams as started, who of them stood on the court in a rally (the bench that never came
/// in is only in the team), and the rallies each side won.
/// </summary>
public sealed record FinishedMatchSummary(
    Guid MatchId,
    CourtSide? Winner,
    IReadOnlyList<Guid> TeamA,
    IReadOnlyList<Guid> TeamB,
    IReadOnlyList<Guid> OnCourtA,
    IReadOnlyList<Guid> OnCourtB,
    int PointsA,
    int PointsB);

/// <summary>The round of a member; <see cref="Results"/> has one entry per finished match they played, in order.</summary>
public sealed record PlayerSummary(
    Guid MemberId,
    int MatchesPlayed,
    int Wins,
    int Losses,
    int Undecided,
    int PointsFor,
    int PointsAgainst,
    int PlusMinus,
    int LongestWinStreak,
    int CurrentWinStreak,
    IReadOnlyList<MatchOutcome> Results,
    PointsByKindSummary PointsByKind,
    CourtSide? MainSide);

/// <summary>Points a member scored by "De quem foi?"; all zero with "pontos individuais" off.</summary>
public sealed record PointsByKindSummary(int Attack, int Block, int Ace, int Other);

/// <summary>"Time que mais venceu" and "Maior sequência" of screen 12: each null on a tie.</summary>
public sealed record SideHighlightsSummary(MostWinsSummary? MostWins, LongestStreakSummary? LongestStreak);

public sealed record MostWinsSummary(CourtSide Side, int Wins);

public sealed record LongestStreakSummary(CourtSide Side, int LongestWinStreak);

/// <summary>One member, or the pair or four of the sand (E3.18, L1).</summary>
public enum MvpKind
{
    Player,
    Team,
}

/// <summary>The MVP of the day from the scoreboard (question 97): on the sand, the team first on the ranking, without a side.</summary>
public sealed record MvpSummary(
    MvpKind Kind,
    IReadOnlyList<Guid> MemberIds,
    CourtSide? Side,
    int MatchesPlayed,
    int Wins,
    int PlusMinus,
    int LongestWinStreak);

/// <summary>A pair or a four of the sand on the ranking of the day (ADR 0048), members in the order of its first match.</summary>
public sealed record TeamStandingSummary(
    IReadOnlyList<Guid> MemberIds,
    int Wins,
    int Losses,
    int Undecided,
    int LongestWinStreak,
    int PointsFor,
    int PointsAgainst);
