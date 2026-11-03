using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;
using static Sacou.Modules.Matches.Domain.CourtSessions.Score.Appliers.ApplierSupport;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score.Appliers;

/// <summary>Port of <c>applyPointScored</c>, <c>applySetEnded</c> and <c>applyServingTeamChanged</c>.</summary>
internal static class SetAppliers
{
    private const int OnePoint = 1;
    private const int OneSet = 1;

    /// <summary>The side-out is derived from the state: that transition is part of what this event means (ADR 0024).</summary>
    public static Result<CourtSessionState, EventRejection> ApplyPointScored(CourtSessionState state, EventEnvelope envelope)
    {
        var parsed = ScorePayloadParser.Parse(envelope.Payload, ScorePayloadShapes.PointScored, PointScoredParser.ParseFields);
        if (parsed.IsFailure)
        {
            return Rejected();
        }

        var payload = parsed.Value;
        var match = FindOpenMatch(state, payload.MatchId);
        if (match is null || FindOpenSet(match, payload.SetNumber) is not { } set)
        {
            return Rejected();
        }

        var score = set.Score.With(payload.Team, set.Score.Of(payload.Team) + OnePoint);
        if (!RotationRules.IsSideOut(set.ServingTeam, payload.Team))
        {
            return Applied(WithCurrentMatch(state, match with { CurrentSet = set with { Score = score } }));
        }

        return Applied(WithCurrentMatch(state, match with
        {
            CurrentSet = set with { Score = score, ServingTeam = payload.Team },
            Rotations = RotateTeam(match.Rotations, payload.Team),
        }));
    }

    public static Result<CourtSessionState, EventRejection> ApplySetEnded(CourtSessionState state, EventEnvelope envelope)
    {
        var parsed = ScorePayloadParser.Parse(envelope.Payload, ScorePayloadShapes.SetEnded, SetEndedParser.ParseFields);
        if (parsed.IsFailure)
        {
            return Rejected();
        }

        var payload = parsed.Value;
        var match = FindOpenMatch(state, payload.MatchId);
        if (match is null
            || FindOpenSet(match, payload.SetNumber) is not { } set
            || OpensSetPastTheFormat(match, payload.SetNumber, payload.NextSet)
            || (payload.NextSet is { } next && !HasZonesForTheRotations(match.Rotations, next.SetterZones)))
        {
            return Rejected();
        }

        var nextSet = payload.NextSet;
        return Applied(WithCurrentMatch(state, match with
        {
            CompletedSets = match.CompletedSets.Add(new CompletedMatchSet(set.Score, payload.SetNumber, payload.Winner)),
            CurrentSet = nextSet is null
                ? null
                : EmptySet(NextSetNumber(payload.SetNumber), nextSet.TargetPoints, nextSet.FirstServer),
            Rotations = nextSet is null ? match.Rotations : WithRecordedZones(match.Rotations, nextSet.SetterZones),
            SetsWon = match.SetsWon.With(payload.Winner, match.SetsWon.Of(payload.Winner) + OneSet),
        }));
    }

    /// <summary>
    /// Records who serves and who served first in the open set, as the command decided: nobody rotates,
    /// and it applies with the rotation off too (ADR 0030).
    /// </summary>
    public static Result<CourtSessionState, EventRejection> ApplyServingTeamChanged(CourtSessionState state, EventEnvelope envelope)
    {
        var parsed = ScorePayloadParser.Parse(
            envelope.Payload, ScorePayloadShapes.ServingTeamChanged, ServingTeamChangedParser.ParseFields);
        if (parsed.IsFailure)
        {
            return Rejected();
        }

        var payload = parsed.Value;
        var match = FindOpenMatch(state, payload.MatchId);
        if (match is null || FindOpenSet(match, payload.SetNumber) is not { } set)
        {
            return Rejected();
        }

        return Applied(WithCurrentMatch(state, match with
        {
            CurrentSet = set with { FirstServer = payload.FirstServer, ServingTeam = payload.ServingTeam },
        }));
    }

    /// <summary>Structure, not a rule: the format has no set past <c>BestOf</c>.</summary>
    private static bool OpensSetPastTheFormat(MatchScore match, int setNumber, NextSet? nextSet) =>
        nextSet is not null && setNumber >= match.Scoring.BestOf;

    /// <summary>Structure, not a rule: a recorded zone must match whether the team has a rotation at all.</summary>
    private static bool HasZonesForTheRotations(BySide<TeamState?> rotations, BySide<int?> setterZones) =>
        (rotations.A is null) == (setterZones.A is null) && (rotations.B is null) == (setterZones.B is null);

    private static BySide<TeamState?> WithRecordedZones(BySide<TeamState?> rotations, BySide<int?> setterZones) =>
        new(WithRecordedZone(rotations.A, setterZones.A), WithRecordedZone(rotations.B, setterZones.B));

    private static TeamState? WithRecordedZone(TeamState? teamState, int? setterZone) =>
        teamState is null || setterZone is not { } zone ? null : teamState with { SetterZone = zone };
}
