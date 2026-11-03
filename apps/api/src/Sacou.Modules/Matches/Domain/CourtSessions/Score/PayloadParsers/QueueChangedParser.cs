using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using static Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers.PayloadValues;
using static Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers.TeamPartsParser;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

/// <summary>Port of <c>parseQueueChangedFields</c>. Whether anyone waiting is on the court is for the applier.</summary>
internal static class QueueChangedParser
{
    public static Result<QueueChangedPayload, PayloadError> ParseFields(RawObject raw)
    {
        if (Uuid(Member(raw, PayloadFields.MatchId)) is not { } matchId)
        {
            return Invalid<QueueChangedPayload>(PayloadFields.MatchId);
        }

        var queue = ParseQueue(Member(raw, PayloadFields.Queue));
        return queue.IsFailure
            ? queue.Forward<QueueChangedPayload>()
            : Result<QueueChangedPayload, PayloadError>.Success(new QueueChangedPayload(matchId, queue.Value));
    }
}
