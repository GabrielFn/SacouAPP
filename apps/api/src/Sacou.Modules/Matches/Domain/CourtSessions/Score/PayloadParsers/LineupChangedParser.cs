using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using static Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers.PayloadValues;
using static Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers.TeamPartsParser;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

/// <summary>
/// Port of <c>parseLineupChangedFields</c>. Format only: whether these are the members of the team,
/// and whether its system plays with a libero, is for the applier, which has the frozen teams.
/// </summary>
internal static class LineupChangedParser
{
    public static Result<LineupChangedPayload, PayloadError> ParseFields(RawObject raw)
    {
        if (Uuid(Member(raw, PayloadFields.MatchId)) is not { } matchId)
        {
            return Invalid<LineupChangedPayload>(PayloadFields.MatchId);
        }

        if (Side(Member(raw, PayloadFields.Team)) is not { } team)
        {
            return Invalid<LineupChangedPayload>(PayloadFields.Team);
        }

        if (LineupMembers(Member(raw, PayloadFields.Lineup)) is not { } lineup)
        {
            return Invalid<LineupChangedPayload>(PayloadFields.Lineup);
        }

        if (SetterZone(Member(raw, PayloadFields.SetterZone)) is not { } setterZone)
        {
            return Invalid<LineupChangedPayload>(PayloadFields.SetterZone);
        }

        if (BenchMembers(Member(raw, PayloadFields.Bench)) is not { } bench
            || bench.Any(memberId => lineup.Contains(memberId, StringComparer.Ordinal)))
        {
            return Invalid<LineupChangedPayload>(PayloadFields.Bench);
        }

        var libero = ParseLibero(Member(raw, PayloadFields.Libero), lineup, bench);
        return libero.IsValid
            ? Result<LineupChangedPayload, PayloadError>.Success(
                new LineupChangedPayload(bench, libero.Libero, lineup, matchId, setterZone, team))
            : Invalid<LineupChangedPayload>(PayloadFields.Libero);
    }
}
