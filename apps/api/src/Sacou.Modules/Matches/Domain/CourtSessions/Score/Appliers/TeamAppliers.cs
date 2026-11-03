using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Queue;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;
using static Sacou.Modules.Matches.Domain.CourtSessions.Score.Appliers.ApplierSupport;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score.Appliers;

/// <summary>Port of <c>applyLineupChanged</c>, <c>applyQueueChanged</c> and <c>applyPointAttributed</c>.</summary>
internal static class TeamAppliers
{
    /// <summary>
    /// Applies the recorded allocation, checked against the frozen teams and never the current lineup,
    /// so the last one in the order wins. Whether the libero is on the court is derived, never checked.
    /// </summary>
    public static Result<CourtSessionState, EventRejection> ApplyLineupChanged(CourtSessionState state, EventEnvelope envelope)
    {
        var parsed = ScorePayloadParser.Parse(envelope.Payload, ScorePayloadShapes.LineupChanged, LineupChangedParser.ParseFields);
        if (parsed.IsFailure)
        {
            return Rejected();
        }

        var payload = parsed.Value;
        var match = FindOpenMatch(state, payload.MatchId);
        if (match is null
            || match.Rotations.Of(payload.Team) is not { } teamState
            || !RotationRules.IsRosterPartition(payload.Lineup, payload.Bench, payload.Libero, match.Teams.Of(payload.Team))
            || !LiberoRules.IsLiberoAllowed(teamState.System, payload.Libero))
        {
            return Rejected();
        }

        var allocated = new TeamState(payload.Bench, payload.Libero, payload.Lineup, payload.SetterZone, teamState.System);
        return Applied(WithCurrentMatch(state, match with { Rotations = match.Rotations.With(payload.Team, allocated) }));
    }

    /// <summary>Replaces the whole queue, checked against the frozen teams: nobody waiting is on the court (ADR 0029).</summary>
    public static Result<CourtSessionState, EventRejection> ApplyQueueChanged(CourtSessionState state, EventEnvelope envelope)
    {
        var parsed = ScorePayloadParser.Parse(envelope.Payload, ScorePayloadShapes.QueueChanged, QueueChangedParser.ParseFields);
        if (parsed.IsFailure)
        {
            return Rejected();
        }

        var payload = parsed.Value;
        var match = FindOpenMatch(state, payload.MatchId);
        return match is null || QueueRules.IsQueueOverlappingTeams(payload.Queue, match.Teams)
            ? Rejected()
            : Applied(state with { Queue = payload.Queue });
    }

    /// <summary>
    /// Changes nothing in the state: who scored is read from the timeline by the resolver. It checks
    /// only that the match is open and that the author plays in it, by the frozen teams (ADR 0031).
    /// </summary>
    public static Result<CourtSessionState, EventRejection> ApplyPointAttributed(CourtSessionState state, EventEnvelope envelope)
    {
        var parsed = ScorePayloadParser.Parse(envelope.Payload, ScorePayloadShapes.PointAttributed, PointAttributedParser.ParseFields);
        if (parsed.IsFailure)
        {
            return Rejected();
        }

        var payload = parsed.Value;
        var match = FindOpenMatch(state, payload.MatchId);
        return match is null || (payload.Author is { } author && !IsMatchMember(match.Teams, author))
            ? Rejected()
            : Applied(state);
    }
}
