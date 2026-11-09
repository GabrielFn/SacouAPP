using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using static Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers.PayloadValues;
using static Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers.TeamPartsParser;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

/// <summary>Port of <c>parsePointScoredFields</c>.</summary>
internal static class PointScoredParser
{
    /// <summary>The payload of a stored <c>PointScored</c>, or <c>null</c> for another event or an invalid payload.</summary>
    public static PointScoredPayload? ReadStored(EventEnvelope envelope)
    {
        if (!string.Equals(envelope.Type, ScoreEventTypes.PointScored, StringComparison.Ordinal))
        {
            return null;
        }

        var parsed = ScorePayloadParser.Parse(envelope.Payload, ScorePayloadShapes.PointScored, ParseFields);
        return parsed.IsSuccess ? parsed.Value : null;
    }

    public static Result<PointScoredPayload, PayloadError> ParseFields(RawObject raw)
    {
        if (Uuid(Member(raw, PayloadFields.MatchId)) is not { } matchId)
        {
            return Invalid<PointScoredPayload>(PayloadFields.MatchId);
        }

        if (SetNumber(Member(raw, PayloadFields.SetNumber)) is not { } setNumber)
        {
            return Invalid<PointScoredPayload>(PayloadFields.SetNumber);
        }

        return Side(Member(raw, PayloadFields.Team)) is { } team
            ? Result<PointScoredPayload, PayloadError>.Success(new PointScoredPayload(matchId, setNumber, team))
            : Invalid<PointScoredPayload>(PayloadFields.Team);
    }
}
