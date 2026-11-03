using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using static Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers.PayloadValues;
using static Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers.TeamPartsParser;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

/// <summary>Port of <c>parseServingTeamChangedFields</c>. Whether the match and the set are open is for the applier.</summary>
internal static class ServingTeamChangedParser
{
    public static Result<ServingTeamChangedPayload, PayloadError> ParseFields(RawObject raw)
    {
        if (Uuid(Member(raw, PayloadFields.MatchId)) is not { } matchId)
        {
            return Invalid<ServingTeamChangedPayload>(PayloadFields.MatchId);
        }

        if (SetNumber(Member(raw, PayloadFields.SetNumber)) is not { } setNumber)
        {
            return Invalid<ServingTeamChangedPayload>(PayloadFields.SetNumber);
        }

        if (Side(Member(raw, PayloadFields.ServingTeam)) is not { } servingTeam)
        {
            return Invalid<ServingTeamChangedPayload>(PayloadFields.ServingTeam);
        }

        return Side(Member(raw, PayloadFields.FirstServer)) is { } firstServer
            ? Result<ServingTeamChangedPayload, PayloadError>.Success(
                new ServingTeamChangedPayload(firstServer, matchId, servingTeam, setNumber))
            : Invalid<ServingTeamChangedPayload>(PayloadFields.FirstServer);
    }
}
