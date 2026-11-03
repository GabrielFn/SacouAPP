using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using static Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers.PayloadValues;
using static Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers.TeamPartsParser;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

/// <summary>Port of <c>parseSetEndedFields</c>, with <c>nextSet</c> and its setter zones.</summary>
internal static class SetEndedParser
{
    public static Result<SetEndedPayload, PayloadError> ParseFields(RawObject raw)
    {
        if (Uuid(Member(raw, PayloadFields.MatchId)) is not { } matchId)
        {
            return Invalid<SetEndedPayload>(PayloadFields.MatchId);
        }

        if (SetNumber(Member(raw, PayloadFields.SetNumber)) is not { } setNumber)
        {
            return Invalid<SetEndedPayload>(PayloadFields.SetNumber);
        }

        if (Side(Member(raw, PayloadFields.Winner)) is not { } winner)
        {
            return Invalid<SetEndedPayload>(PayloadFields.Winner);
        }

        var nextSet = ParseNextSet(Member(raw, PayloadFields.NextSet));
        return nextSet.IsFailure
            ? nextSet.Forward<SetEndedPayload>()
            : Result<SetEndedPayload, PayloadError>.Success(new SetEndedPayload(matchId, nextSet.Value.Value, setNumber, winner));
    }

    /// <summary>JSON null: the set ended the match.</summary>
    private static Result<Optional<NextSet>, PayloadError> ParseNextSet(RawValue? value)
    {
        string FieldOf(string key) => PayloadFields.Path(PayloadFields.NextSet, key);

        if (IsNull(value))
        {
            return Result<Optional<NextSet>, PayloadError>.Success(Optional<NextSet>.None);
        }

        if (value is not RawObject raw)
        {
            return Invalid<Optional<NextSet>>(PayloadFields.NextSet);
        }

        if (SetPoints(Member(raw, PayloadFields.TargetPoints)) is not { } targetPoints)
        {
            return Invalid<Optional<NextSet>>(FieldOf(PayloadFields.TargetPoints));
        }

        if (Side(Member(raw, PayloadFields.FirstServer)) is not { } firstServer)
        {
            return Invalid<Optional<NextSet>>(FieldOf(PayloadFields.FirstServer));
        }

        var setterZones = ParseSetterZones(Member(raw, PayloadFields.SetterZones));
        return setterZones.IsFailure
            ? setterZones.Forward<Optional<NextSet>>()
            : Result<Optional<NextSet>, PayloadError>.Success(
                Optional<NextSet>.Some(new NextSet(firstServer, setterZones.Value, targetPoints)));
    }

    /// <summary>JSON null for a team with the rotation off.</summary>
    private static Result<BySide<int?>, PayloadError> ParseSetterZones(RawValue? value)
    {
        var field = PayloadFields.Path(PayloadFields.NextSet, PayloadFields.SetterZones);
        if (value is not RawObject raw)
        {
            return Invalid<BySide<int?>>(field);
        }

        var rawA = Member(raw, PayloadFields.SideA);
        var a = SetterZone(rawA);
        if (!IsNull(rawA) && a is null)
        {
            return Invalid<BySide<int?>>(PayloadFields.Path(field, PayloadFields.SideA));
        }

        var rawB = Member(raw, PayloadFields.SideB);
        var b = SetterZone(rawB);
        return !IsNull(rawB) && b is null
            ? Invalid<BySide<int?>>(PayloadFields.Path(field, PayloadFields.SideB))
            : Result<BySide<int?>, PayloadError>.Success(new BySide<int?>(a, b));
    }
}
