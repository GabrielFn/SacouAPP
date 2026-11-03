using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using static Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers.PayloadValues;
using static Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers.TeamPartsParser;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

/// <summary>
/// Port of <c>parsePointAttributedFields</c>. Format only: whether the point exists and the author
/// played it is for the applier and the resolver. A missing author is invalid (ADR 0031).
/// </summary>
internal static class PointAttributedParser
{
    public static Result<PointAttributedPayload, PayloadError> ParseFields(RawObject raw)
    {
        if (Uuid(Member(raw, PayloadFields.MatchId)) is not { } matchId)
        {
            return Invalid<PointAttributedPayload>(PayloadFields.MatchId);
        }

        if (Uuid(Member(raw, PayloadFields.PointEventId)) is not { } pointEventId)
        {
            return Invalid<PointAttributedPayload>(PayloadFields.PointEventId);
        }

        if (Kind(Member(raw, PayloadFields.Kind)) is not { } kind)
        {
            return Invalid<PointAttributedPayload>(PayloadFields.Kind);
        }

        var rawAuthor = Member(raw, PayloadFields.Author);
        var author = Uuid(rawAuthor);
        var isAuthorOfTheKind = IsNull(rawAuthor)
            ? PointKind.Authorless.Contains(kind)
            : author is not null && !PointKind.Authorless.Contains(kind);
        return isAuthorOfTheKind
            ? Result<PointAttributedPayload, PayloadError>.Success(new PointAttributedPayload(author, kind, matchId, pointEventId))
            : Invalid<PointAttributedPayload>(PayloadFields.Author);
    }
}
