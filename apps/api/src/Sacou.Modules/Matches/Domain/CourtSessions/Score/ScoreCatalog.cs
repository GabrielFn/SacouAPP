using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score;

/// <summary>The event types of the score catalog (ADR 0023 and the ADRs that extended it).</summary>
internal static class ScoreEventTypes
{
    public const string MatchStarted = "MatchStarted";
    public const string PointScored = "PointScored";
    public const string SetEnded = "SetEnded";
    public const string MatchEnded = "MatchEnded";
    public const string LineupChanged = "LineupChanged";
    public const string QueueChanged = "QueueChanged";
    public const string ServingTeamChanged = "ServingTeamChanged";
    public const string PointAttributed = "PointAttributed";

    public static readonly ImmutableArray<string> All =
        [MatchStarted, PointScored, SetEnded, MatchEnded, LineupChanged, QueueChanged, ServingTeamChanged, PointAttributed];
}

/// <summary>Port of the limits of <c>score/constants.data.ts</c>. Technical limits, not volleyball rules, unless said.</summary>
internal static class ScoreLimits
{
    public const long MinVersion = 1;

    /// <summary>The scoreboard shows two digits.</summary>
    public const int MinSetPoints = 1;
    public const int MaxSetPoints = 99;

    public const int FirstSetNumber = 1;
    public const int LastSetNumber = 5;

    /// <summary>Above any team with a bench.</summary>
    public const int MinTeamMembers = 1;
    public const int MaxTeamMembers = 24;

    /// <summary>A team with its rotation on always has six in the lineup, and the bench holds the others.</summary>
    public const int LineupMembers = 6;
    public const int MinBenchMembers = 0;
    public const int MaxBenchMembers = MaxTeamMembers - LineupMembers;

    public const int MinQueuePlayers = 0;

    /// <summary>
    /// A real round stays near 30 matches. The state copies and searches this list at each match, so a
    /// hostile log must not make it grow. A new <c>MatchStarted</c> with 200 finished is rejected.
    /// </summary>
    public const int MaxFinishedMatches = 200;

    public static readonly ImmutableArray<int> BestOfValues = [1, 3, 5];

    /// <summary>2 means advantage; 1 means none.</summary>
    public static readonly ImmutableArray<int> WinMarginValues = [1, 2];
}

/// <summary>Why a match ended: by the sets, or by hand.</summary>
internal sealed record MatchEndReason
{
    public static readonly MatchEndReason SetsWon = new("sets-won");
    public static readonly MatchEndReason Manual = new("manual");

    public static readonly ImmutableArray<MatchEndReason> All = [SetsWon, Manual];

    private MatchEndReason(string code) => Code = code;

    public string Code { get; }
}

/// <summary>What "De quem foi?" records about a point, by allowed list (ADR 0031).</summary>
internal sealed record PointKind
{
    public static readonly PointKind Attack = new("attack");
    public static readonly PointKind Block = new("block");
    public static readonly PointKind Ace = new("ace");
    public static readonly PointKind Other = new("other");
    public static readonly PointKind OpponentError = new("opponent-error");

    public static readonly ImmutableArray<PointKind> All = [Attack, Block, Ace, Other, OpponentError];

    /// <summary>Only an error of the opponent has no author; the others always have one.</summary>
    public static readonly ImmutableArray<PointKind> Authorless = [OpponentError];

    private PointKind(string code) => Code = code;

    public string Code { get; }
}
