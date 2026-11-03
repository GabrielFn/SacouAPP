using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;

namespace Sacou.Modules.Matches.Domain.CourtSessions.PlayerStatistics;

/// <summary>How a finished match went for a member or a side: without a winner it is neither (ADR 0032).</summary>
internal sealed record MatchResult
{
    public static readonly MatchResult Win = new("win");
    public static readonly MatchResult Loss = new("loss");
    public static readonly MatchResult Undecided = new("undecided");

    public static readonly ImmutableArray<MatchResult> All = [Win, Loss, Undecided];

    private MatchResult(string code) => Code = code;

    public string Code { get; }
}

/// <summary>
/// Points a member scored, by "De quem foi?", in the order of <see cref="CreditedPointKinds"/>: an
/// error of the opponent credits nobody (ADR 0031).
/// </summary>
internal sealed record PointsByKind(int Attack, int Block, int Ace, int Other)
{
    public static readonly PointsByKind None = new(0, 0, 0, 0);

    /// <summary><see cref="PointKind.All"/> without <see cref="PointKind.Authorless"/>, in that order.</summary>
    public static readonly ImmutableArray<PointKind> CreditedPointKinds = [PointKind.Attack, PointKind.Block, PointKind.Ace, PointKind.Other];

    private const int OnePoint = 1;

    /// <summary>One more point of a credited kind.</summary>
    public PointsByKind Credit(PointKind kind) => kind == PointKind.Attack ? this with { Attack = Attack + OnePoint }
        : kind == PointKind.Block ? this with { Block = Block + OnePoint }
        : kind == PointKind.Ace ? this with { Ace = Ace + OnePoint }
        : this with { Other = Other + OnePoint };

    public PointsByKind Add(PointsByKind other) =>
        new(Attack + other.Attack, Block + other.Block, Ace + other.Ace, Other + other.Other);
}

/// <summary>Points scored and conceded while the member stood on the court.</summary>
internal sealed record CourtBalance(int PointsFor, int PointsAgainst)
{
    public static readonly CourtBalance None = new(0, 0);
}

/// <summary>Wins in a row: the longest run, and the run that ends with the last finished match.</summary>
internal sealed record WinStreaks(int LongestWinStreak, int CurrentWinStreak)
{
    public static readonly WinStreaks None = new(0, 0);
}

/// <summary>
/// The round of a member on one court, from the finished matches only. Only ids and integers, in the
/// key order of the contract with TypeScript (ADR 0032). <c>Results</c> has one entry per finished
/// match the member played, in order.
/// </summary>
internal sealed record PlayerStats(
    string MemberId,
    int MatchesPlayed,
    int Wins,
    int Losses,
    int Undecided,
    int PointsFor,
    int PointsAgainst,
    int PlusMinus,
    int LongestWinStreak,
    int CurrentWinStreak,
    ImmutableArray<MatchResult> Results,
    PointsByKind PointsByKind);

/// <summary>A side of the court counts as a team, whoever plays on it (ADR 0032, P3).</summary>
internal sealed record SideStats(int Wins, int LongestWinStreak, int CurrentWinStreak);
