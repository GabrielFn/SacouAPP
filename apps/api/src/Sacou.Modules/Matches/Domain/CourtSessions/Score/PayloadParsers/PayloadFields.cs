namespace Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

/// <summary>
/// The keys of the payloads and the paths an error reports, port of <c>ScorePayloadField</c>. An
/// error names one of these, never a received key or value.
/// </summary>
internal static class PayloadFields
{
    /// <summary>Reported when the input as a whole is not a payload object, or for a type outside the catalog.</summary>
    public const string Root = "payload";

    /// <summary>Reported instead of the name of an unknown key, which is received data and may be personal.</summary>
    public const string UnknownField = "unknown-field";

    public const string MatchId = "matchId";
    public const string RulesVersion = "rulesVersion";
    public const string FormationsVersion = "formationsVersion";
    public const string Scoring = "scoring";
    public const string BestOf = "bestOf";
    public const string PointsPerSet = "pointsPerSet";
    public const string TieBreakPoints = "tieBreakPoints";
    public const string WinMargin = "winMargin";
    public const string Teams = "teams";
    public const string MemberIds = "memberIds";
    public const string FirstServer = "firstServer";
    public const string Rotations = "rotations";
    public const string Lineup = "lineup";
    public const string SetterZone = "setterZone";
    public const string System = "system";
    public const string Bench = "bench";
    public const string Libero = "libero";
    public const string MemberId = "memberId";
    public const string ReplacedIndexes = "replacedIndexes";
    public const string Queue = "queue";
    public const string Players = "players";
    public const string SetNumber = "setNumber";
    public const string Team = "team";
    public const string Winner = "winner";
    public const string NextSet = "nextSet";
    public const string TargetPoints = "targetPoints";
    public const string SetterZones = "setterZones";
    public const string EndReason = "endReason";
    public const string ServingTeam = "servingTeam";
    public const string PointEventId = "pointEventId";
    public const string Kind = "kind";
    public const string Author = "author";
    public const string SideA = "a";
    public const string SideB = "b";

    private const string Separator = ".";

    /// <summary>A path below a field, such as <c>rotations.a.lineup</c>.</summary>
    public static string Path(params string[] keys) => string.Join(Separator, keys);
}
