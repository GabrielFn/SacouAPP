using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.Attributions;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Queue;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Writes;

/// <summary>Why an event is implausible, by closed list.</summary>
internal static class ImplausibleReasons
{
    public const string MatchPending = "match-pending";
    public const string SetDecided = "set-decided";
    public const string SetNotDecided = "set-not-decided";
    public const string WrongSetWinner = "wrong-set-winner";
    public const string WrongNextSet = "wrong-next-set";
    public const string WrongTargetPoints = "wrong-target-points";
    public const string WrongSetterZones = "wrong-setter-zones";
    public const string WrongFirstServer = "wrong-first-server";
    public const string WrongMatchWinner = "wrong-match-winner";
    public const string WrongServingTeam = "wrong-serving-team";
    public const string InvalidAttributionTarget = "invalid-attribution-target";
    public const string InvalidPointAuthor = "invalid-point-author";
    public const string QueueUnchanged = "queue-unchanged";
    public const string UnsupportedRulesVersion = "unsupported-rules-version";
    public const string UnsupportedFormationsVersion = "unsupported-formations-version";

    public static readonly ImmutableArray<string> All =
    [
        MatchPending,
        SetDecided,
        SetNotDecided,
        WrongSetWinner,
        WrongNextSet,
        WrongTargetPoints,
        WrongSetterZones,
        WrongFirstServer,
        WrongMatchWinner,
        WrongServingTeam,
        InvalidAttributionTarget,
        InvalidPointAuthor,
        QueueUnchanged,
        UnsupportedRulesVersion,
        UnsupportedFormationsVersion,
    ];
}

/// <summary>
/// The event proves its format, not its truth (ADR 0060, D10, class a): what an honest phone never
/// records, because the commands of match-engine refuse it, is refused here too. Each check reads only
/// the stream, through the timeline right before the event, and immutable catalogs. Data that changes
/// during a round, such as attendance, the queue mode or the plan, is never checked (class b).
/// </summary>
internal static class EventPlausibility
{
    private const int SingleSet = 1;
    private const int OneSet = 1;
    private const int NoPoints = 0;

    /// <summary>
    /// Between a deciding <c>SetEnded</c> and its <c>MatchEnded</c> the commands emit only the end of the
    /// match, an undo, and "De quem foi?" on a point of the match.
    /// </summary>
    private static readonly ImmutableArray<string> TypesWhileMatchPending =
        [ScoreEventTypes.MatchEnded, ScoreEventTypes.PointAttributed, EventLogSchema.RevertedToEventType];

    /// <summary>
    /// The reason the event is implausible on the timeline right before it, or null when it is
    /// plausible. Only for an event the replay accepted there, so its match and set are the open ones.
    /// </summary>
    public static string? Check(EventEnvelope envelope, Timeline<CourtSessionState> before, CourtWriteContext context)
    {
        var state = before.StateOr(CourtSessionState.Initial);
        if (state.CurrentMatch is { CurrentSet: null } && !TypesWhileMatchPending.Contains(envelope.Type, StringComparer.Ordinal))
        {
            return ImplausibleReasons.MatchPending;
        }

        var parsed = ScorePayloadParser.Parse(envelope.Type, envelope.Payload);
        if (parsed.IsFailure || state.CurrentMatch is not { } match)
        {
            // A RevertedTo, whose target the replay checked, or a MatchStarted, which needs no open match.
            return parsed.IsSuccess && parsed.Value is MatchStartedPayload started ? CheckMatchStarted(started, context) : null;
        }

        return parsed.Value switch
        {
            PointScoredPayload => IsDecided(match) ? ImplausibleReasons.SetDecided : null,
            SetEndedPayload ended => CheckSetEnded(ended, match),
            MatchEndedPayload ended => CheckMatchEnded(ended, match),
            ServingTeamChangedPayload changed => CheckServingTeamChanged(changed, match),
            PointAttributedPayload attributed => CheckPointAttributed(attributed, before),
            QueueChangedPayload changed => IsSameQueue(state.Queue, changed.Queue) ? ImplausibleReasons.QueueUnchanged : null,
            _ => null,
        };
    }

    private static string? CheckMatchStarted(MatchStartedPayload started, CourtWriteContext context) =>
        !context.SupportedRulesVersions.Contains(started.RulesVersion) ? ImplausibleReasons.UnsupportedRulesVersion
        : !context.SupportedFormationsVersions.Contains(started.FormationsVersion) ? ImplausibleReasons.UnsupportedFormationsVersion
        : null;

    private static bool IsDecided(MatchScore match) =>
        match.CurrentSet is { } set && ScoreRules.GetSetWinner(set.Score, set.TargetPoints, match.Scoring.WinMargin) is not null;

    /// <summary>Port of <c>confirmSetEnd</c>: the winner of the score, and a next set only while nobody won the match.</summary>
    private static string? CheckSetEnded(SetEndedPayload ended, MatchScore match)
    {
        if (match.CurrentSet is not { } set)
        {
            return ImplausibleReasons.SetNotDecided;
        }

        var winner = ScoreRules.GetSetWinner(set.Score, set.TargetPoints, match.Scoring.WinMargin);
        if (winner is null)
        {
            return ImplausibleReasons.SetNotDecided;
        }

        if (winner != ended.Winner)
        {
            return ImplausibleReasons.WrongSetWinner;
        }

        var setsWon = match.SetsWon.With(winner, match.SetsWon.Of(winner) + OneSet);
        var decidesTheMatch = ScoreRules.GetMatchWinner(setsWon, match.Scoring.BestOf) is not null;
        if (decidesTheMatch != (ended.NextSet is null))
        {
            return ImplausibleReasons.WrongNextSet;
        }

        return ended.NextSet is { } next ? CheckNextSet(next, match, set) : null;
    }

    /// <summary>
    /// Port of <c>endSet</c>: the target of the next set, the rotations carried on, and who serves first
    /// alternated, unless the next set is the deciding one, whose toss belongs to the writer.
    /// </summary>
    private static string? CheckNextSet(NextSet next, MatchScore match, MatchSet set)
    {
        var nextSetNumber = set.SetNumber + OneSet;
        var currentZones = new BySide<int?>(match.Rotations.A?.SetterZone, match.Rotations.B?.SetterZone);
        var isDecidingSet = match.Scoring.BestOf > SingleSet && nextSetNumber == match.Scoring.BestOf;
        return next.TargetPoints != ScoreRules.TargetPointsForSet(match.Scoring, nextSetNumber) ? ImplausibleReasons.WrongTargetPoints
            : next.SetterZones != currentZones ? ImplausibleReasons.WrongSetterZones
            : !isDecidingSet && next.FirstServer != RotationRules.GetNextSetFirstServer(set.FirstServer) ? ImplausibleReasons.WrongFirstServer
            : null;
    }

    /// <summary>The applier refuses an end by the sets with a set open; a manual end records the caller's choice.</summary>
    private static string? CheckMatchEnded(MatchEndedPayload ended, MatchScore match) =>
        ended.EndReason == MatchEndReason.SetsWon && ended.Winner != ScoreRules.GetMatchWinner(match.SetsWon, match.Scoring.BestOf)
            ? ImplausibleReasons.WrongMatchWinner
            : null;

    /// <summary>Port of <c>switchServingTeam</c>: the other team serves, and at 0-0 it also served first.</summary>
    private static string? CheckServingTeamChanged(ServingTeamChangedPayload changed, MatchScore match)
    {
        if (IsDecided(match))
        {
            return ImplausibleReasons.SetDecided;
        }

        if (match.CurrentSet is not { } set)
        {
            return ImplausibleReasons.SetDecided;
        }

        var servingTeam = set.ServingTeam.Opponent();
        var hasNoPoints = set.Score.A == NoPoints && set.Score.B == NoPoints;
        return changed.ServingTeam != servingTeam ? ImplausibleReasons.WrongServingTeam
            : changed.FirstServer != (hasNoPoints ? servingTeam : set.FirstServer) ? ImplausibleReasons.WrongFirstServer
            : null;
    }

    private static string? CheckPointAttributed(PointAttributedPayload attributed, Timeline<CourtSessionState> before)
    {
        var rally = AttributionPlausibility.FindRally(before, attributed.MatchId, attributed.PointEventId);
        return rally is null ? ImplausibleReasons.InvalidAttributionTarget
            : !AttributionPlausibility.IsValidAuthor(rally, attributed.Kind, attributed.Author) ? ImplausibleReasons.InvalidPointAuthor
            : null;
    }

    /// <summary>Port of <c>isSameQueue</c> of <c>queue/commands.ts</c>: the same members in the same order.</summary>
    private static bool IsSameQueue(TeamQueue first, TeamQueue second) =>
        first.Players.SequenceEqual(second.Players, StringComparer.Ordinal)
        && first.Teams.Length == second.Teams.Length
        && first.Teams.Zip(second.Teams).All(pair => pair.First.MemberIds.SequenceEqual(pair.Second.MemberIds, StringComparer.Ordinal));
}
