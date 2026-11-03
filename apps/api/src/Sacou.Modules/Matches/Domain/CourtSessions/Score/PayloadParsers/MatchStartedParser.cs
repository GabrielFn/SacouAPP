using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Queue;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using static Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers.PayloadValues;
using static Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers.TeamPartsParser;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

/// <summary>Port of <c>parseMatchStartedFields</c>: the fields in the order of the schema, the queue last.</summary>
internal static class MatchStartedParser
{
    public static Result<MatchStartedPayload, PayloadError> ParseFields(RawObject raw)
    {
        if (Uuid(Member(raw, PayloadFields.MatchId)) is not { } matchId)
        {
            return Invalid<MatchStartedPayload>(PayloadFields.MatchId);
        }

        if (Version(Member(raw, PayloadFields.RulesVersion)) is not { } rulesVersion)
        {
            return Invalid<MatchStartedPayload>(PayloadFields.RulesVersion);
        }

        if (Version(Member(raw, PayloadFields.FormationsVersion)) is not { } formationsVersion)
        {
            return Invalid<MatchStartedPayload>(PayloadFields.FormationsVersion);
        }

        var scoring = ParseScoring(Member(raw, PayloadFields.Scoring));
        if (scoring.IsFailure)
        {
            return scoring.Forward<MatchStartedPayload>();
        }

        var teams = ParseTeams(Member(raw, PayloadFields.Teams));
        if (teams.IsFailure)
        {
            return teams.Forward<MatchStartedPayload>();
        }

        if (Side(Member(raw, PayloadFields.FirstServer)) is not { } firstServer)
        {
            return Invalid<MatchStartedPayload>(PayloadFields.FirstServer);
        }

        var rotations = ParseRotations(Member(raw, PayloadFields.Rotations), teams.Value);
        if (rotations.IsFailure)
        {
            return rotations.Forward<MatchStartedPayload>();
        }

        var queue = ParseMatchQueue(Member(raw, PayloadFields.Queue), teams.Value);
        if (queue.IsFailure)
        {
            return queue.Forward<MatchStartedPayload>();
        }

        return Result<MatchStartedPayload, PayloadError>.Success(new MatchStartedPayload(
            firstServer,
            formationsVersion,
            matchId,
            queue.Value,
            rotations.Value,
            rulesVersion,
            scoring.Value,
            teams.Value));
    }

    private static Result<ScoringRules, PayloadError> ParseScoring(RawValue? value)
    {
        string FieldOf(string key) => PayloadFields.Path(PayloadFields.Scoring, key);

        if (value is not RawObject raw)
        {
            return Invalid<ScoringRules>(PayloadFields.Scoring);
        }

        if (OneOf(Member(raw, PayloadFields.BestOf), ScoreLimits.BestOfValues) is not { } bestOf)
        {
            return Invalid<ScoringRules>(FieldOf(PayloadFields.BestOf));
        }

        if (SetPoints(Member(raw, PayloadFields.PointsPerSet)) is not { } pointsPerSet)
        {
            return Invalid<ScoringRules>(FieldOf(PayloadFields.PointsPerSet));
        }

        var rawTieBreakPoints = Member(raw, PayloadFields.TieBreakPoints);
        var tieBreakPoints = SetPoints(rawTieBreakPoints);
        if (!IsNull(rawTieBreakPoints) && tieBreakPoints is null)
        {
            return Invalid<ScoringRules>(FieldOf(PayloadFields.TieBreakPoints));
        }

        return OneOf(Member(raw, PayloadFields.WinMargin), ScoreLimits.WinMarginValues) is { } winMargin
            ? Result<ScoringRules, PayloadError>.Success(new ScoringRules(bestOf, pointsPerSet, tieBreakPoints, winMargin))
            : Invalid<ScoringRules>(FieldOf(PayloadFields.WinMargin));
    }

    private static Result<BySide<TeamState?>, PayloadError> ParseRotations(RawValue? value, BySide<TeamRoster> teams)
    {
        if (value is not RawObject raw)
        {
            return Invalid<BySide<TeamState?>>(PayloadFields.Rotations);
        }

        var a = ParseTeamState(Member(raw, PayloadFields.SideA), teams.A, PayloadFields.SideA);
        if (a.IsFailure)
        {
            return a.Forward<BySide<TeamState?>>();
        }

        var b = ParseTeamState(Member(raw, PayloadFields.SideB), teams.B, PayloadFields.SideB);
        return b.IsFailure
            ? b.Forward<BySide<TeamState?>>()
            : Result<BySide<TeamState?>, PayloadError>.Success(new BySide<TeamState?>(a.Value.Value, b.Value.Value));
    }

    /// <summary>Last, because it is checked against the teams: nobody waiting is on the court.</summary>
    private static Result<TeamQueue, PayloadError> ParseMatchQueue(RawValue? value, BySide<TeamRoster> teams)
    {
        var queue = ParseQueue(value);
        return queue.IsSuccess && QueueRules.IsQueueOverlappingTeams(queue.Value, teams)
            ? Invalid<TeamQueue>(PayloadFields.Queue)
            : queue;
    }
}
