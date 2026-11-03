using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

/// <summary>
/// Port of <c>parseScorePayload</c>: fails closed. Unknown keys are checked first, at every level;
/// then the fields, in the order of the schema. Errors carry a path of the schema, never input.
/// </summary>
internal static class ScorePayloadParser
{
    private static readonly ImmutableDictionary<string, Func<RawValue, Result<ScorePayload, PayloadError>>> ParsersByType =
        ImmutableDictionary.CreateRange(
            StringComparer.Ordinal,
            [
                Entry<MatchStartedPayload>(ScoreEventTypes.MatchStarted, ScorePayloadShapes.MatchStarted, MatchStartedParser.ParseFields),
                Entry<PointScoredPayload>(ScoreEventTypes.PointScored, ScorePayloadShapes.PointScored, PointScoredParser.ParseFields),
                Entry<SetEndedPayload>(ScoreEventTypes.SetEnded, ScorePayloadShapes.SetEnded, SetEndedParser.ParseFields),
                Entry<MatchEndedPayload>(ScoreEventTypes.MatchEnded, ScorePayloadShapes.MatchEnded, MatchEndedParser.ParseFields),
                Entry<LineupChangedPayload>(ScoreEventTypes.LineupChanged, ScorePayloadShapes.LineupChanged, LineupChangedParser.ParseFields),
                Entry<QueueChangedPayload>(ScoreEventTypes.QueueChanged, ScorePayloadShapes.QueueChanged, QueueChangedParser.ParseFields),
                Entry<ServingTeamChangedPayload>(
                    ScoreEventTypes.ServingTeamChanged, ScorePayloadShapes.ServingTeamChanged, ServingTeamChangedParser.ParseFields),
                Entry<PointAttributedPayload>(
                    ScoreEventTypes.PointAttributed, ScorePayloadShapes.PointAttributed, PointAttributedParser.ParseFields),
            ]);

    /// <summary>A type outside the score catalog has no valid payload here.</summary>
    public static Result<ScorePayload, PayloadError> Parse(string type, RawValue payload) =>
        ParsersByType.TryGetValue(type, out var parser)
            ? parser(payload)
            : Result<ScorePayload, PayloadError>.Failure(new PayloadError(PayloadFields.Root));

    /// <summary>One parser, typed, for the appliers, which know the type of their event.</summary>
    public static Result<T, PayloadError> Parse<T>(
        RawValue payload,
        PayloadShape shape,
        Func<RawObject, Result<T, PayloadError>> parseFields)
        where T : ScorePayload
    {
        if (payload is not RawObject record)
        {
            return TeamPartsParser.Invalid<T>(PayloadFields.Root);
        }

        return shape.HasUnknownKey(record) ? TeamPartsParser.Invalid<T>(PayloadFields.UnknownField) : parseFields(record);
    }

    private static KeyValuePair<string, Func<RawValue, Result<ScorePayload, PayloadError>>> Entry<T>(
        string type,
        PayloadShape shape,
        Func<RawObject, Result<T, PayloadError>> parseFields)
        where T : ScorePayload =>
        KeyValuePair.Create<string, Func<RawValue, Result<ScorePayload, PayloadError>>>(type, payload =>
        {
            var parsed = Parse(payload, shape, parseFields);
            return parsed.IsSuccess
                ? Result<ScorePayload, PayloadError>.Success(parsed.Value)
                : Result<ScorePayload, PayloadError>.Failure(parsed.Error);
        });
}
