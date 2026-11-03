using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;
using static Sacou.Modules.Matches.Domain.CourtSessions.Score.Appliers.ApplierSupport;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score.Appliers;

/// <summary>Port of <c>applyMatchStarted</c> and <c>applyMatchEnded</c>.</summary>
internal static class MatchAppliers
{
    public static Result<CourtSessionState, EventRejection> ApplyMatchStarted(CourtSessionState state, EventEnvelope envelope)
    {
        var parsed = ScorePayloadParser.Parse(envelope.Payload, ScorePayloadShapes.MatchStarted, MatchStartedParser.ParseFields);
        if (parsed.IsFailure || !CanOpenMatch(state, parsed.Value.MatchId))
        {
            return Rejected();
        }

        var payload = parsed.Value;
        var match = new MatchScore(
            [],
            // Set 1 is never the deciding set of a series, so it always plays to PointsPerSet.
            EmptySet(ScoreLimits.FirstSetNumber, payload.Scoring.PointsPerSet, payload.FirstServer),
            payload.FormationsVersion,
            payload.MatchId,
            payload.Rotations,
            payload.RulesVersion,
            payload.Scoring,
            new BySide<int>(0, 0),
            payload.Teams);
        return Applied(new CourtSessionState(match, state.FinishedMatches, payload.Queue));
    }

    public static Result<CourtSessionState, EventRejection> ApplyMatchEnded(CourtSessionState state, EventEnvelope envelope)
    {
        var parsed = ScorePayloadParser.Parse(envelope.Payload, ScorePayloadShapes.MatchEnded, MatchEndedParser.ParseFields);
        if (parsed.IsFailure)
        {
            return Rejected();
        }

        var payload = parsed.Value;
        var match = FindOpenMatch(state, payload.MatchId);
        if (match is null || (payload.EndReason == MatchEndReason.SetsWon && match.CurrentSet is not null))
        {
            return Rejected();
        }

        return Applied(new CourtSessionState(
            null,
            state.FinishedMatches.Add(new FinishedMatch(match, payload.EndReason, payload.Winner)),
            state.Queue));
    }

    /// <summary>No match open, room in the round, and an id never used by a finished match.</summary>
    private static bool CanOpenMatch(CourtSessionState state, string matchId) =>
        state.CurrentMatch is null
        && state.FinishedMatches.Length < ScoreLimits.MaxFinishedMatches
        && !IsFinishedMatchId(state, matchId);
}
