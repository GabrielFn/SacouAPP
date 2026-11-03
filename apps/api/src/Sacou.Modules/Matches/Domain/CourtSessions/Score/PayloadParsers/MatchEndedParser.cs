using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using static Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers.PayloadValues;
using static Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers.TeamPartsParser;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

/// <summary>Port of <c>parseMatchEndedFields</c>: a match won by the sets always has a winner.</summary>
internal static class MatchEndedParser
{
    public static Result<MatchEndedPayload, PayloadError> ParseFields(RawObject raw)
    {
        if (Uuid(Member(raw, PayloadFields.MatchId)) is not { } matchId)
        {
            return Invalid<MatchEndedPayload>(PayloadFields.MatchId);
        }

        if (EndReason(Member(raw, PayloadFields.EndReason)) is not { } endReason)
        {
            return Invalid<MatchEndedPayload>(PayloadFields.EndReason);
        }

        var rawWinner = Member(raw, PayloadFields.Winner);
        var winner = Side(rawWinner);
        var isValidWinner = IsNull(rawWinner) ? endReason != MatchEndReason.SetsWon : winner is not null;
        return isValidWinner
            ? Result<MatchEndedPayload, PayloadError>.Success(new MatchEndedPayload(endReason, matchId, winner))
            : Invalid<MatchEndedPayload>(PayloadFields.Winner);
    }
}
