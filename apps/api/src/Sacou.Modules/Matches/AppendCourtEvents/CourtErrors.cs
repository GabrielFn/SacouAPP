using System.Collections.Immutable;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;
using Sacou.Modules.Matches.Infrastructure;
using Sacou.Shared.Results;

namespace Sacou.Modules.Matches.AppendCourtEvents;

/// <summary>
/// The answers of the court stream route (ADR 0060, D1 and D15): the request (400), the stream and its writer
/// (404, 409) and the content (422). The pt-BR texts are the app's, by code (E4.11).
/// </summary>
internal static class CourtErrors
{
    public const string Prefix = "matches.";

    public static readonly Error BatchInvalid = Validation(EventBatchError.BatchInvalidCode);
    public static readonly Error EventTooLarge = Validation(EventBatchError.EventTooLargeCode);
    public static readonly Error InvalidEnvelope = Validation(EventBatchError.InvalidEnvelopeCode);
    public static readonly Error StreamMismatch = Validation(CourtWriteErrorCode.StreamMismatch.Code);
    public static readonly Error UnsupportedSchemaVersion = Validation(CourtWriteErrorCode.UnsupportedSchemaVersion.Code);
    public static readonly Error UnknownEventType = Validation(CourtWriteErrorCode.UnknownEventType.Code);
    public static readonly Error TakeoverInvalid = Validation(CourtWriteErrorCode.TakeoverInvalid.Code);

    /// <summary>Another round's or group's stream looks like no stream at all.</summary>
    public static readonly Error CourtSessionNotFound = new(Prefix + "court-session-not-found", ErrorKind.NotFound);

    public static readonly Error RoundHasCourtSession = Conflict("round-has-court-session");
    public static readonly Error RoundCanceled = Conflict("round-canceled");
    public static readonly Error NotTheWriter = Conflict(CourtWriteErrorCode.NotTheWriter.Code);
    public static readonly Error BatchMismatch = Conflict(CourtWriteErrorCode.BatchMismatch.Code);
    public static readonly Error EventIdConflict = Conflict(CourtWriteErrorCode.EventIdConflict.Code);
    public static readonly Error SequenceGap = Conflict(CourtWriteErrorCode.SequenceGap.Code);
    public static readonly Error SequenceConflict = Conflict(CourtWriteErrorCode.SequenceConflict.Code);
    public static readonly Error StreamChanged = Conflict(CourtWriteErrorCode.StreamChanged.Code);

    public static readonly Error LimitReached = Unprocessable(CourtWriteErrorCode.LimitReached.Code);
    public static readonly Error EventRejected = Unprocessable(CourtWriteErrorCode.EventRejected.Code);
    public static readonly Error EventImplausible = Unprocessable(CourtWriteErrorCode.EventImplausible.Code);
    public static readonly Error MemberNotInGroup = Unprocessable(CourtWriteErrorCode.MemberNotInGroup.Code);

    private static readonly ImmutableDictionary<string, Error> ByWriteCode = new[]
    {
        BatchInvalid, StreamMismatch, UnsupportedSchemaVersion, UnknownEventType, NotTheWriter, BatchMismatch, EventIdConflict,
        SequenceGap, SequenceConflict, LimitReached, EventRejected, EventImplausible, MemberNotInGroup, TakeoverInvalid,
        StreamChanged,
    }.ToImmutableDictionary(error => error.Code[Prefix.Length..], StringComparer.Ordinal);

    private static readonly ImmutableDictionary<string, Error> ByReadCode = new[] { BatchInvalid, EventTooLarge, InvalidEnvelope }
        .ToImmutableDictionary(error => error.Code[Prefix.Length..], StringComparer.Ordinal);

    /// <summary>Every code of the domain's closed list has its answer; a new one without it fails the start of a test.</summary>
    public static Error Of(CourtWriteErrorCode code)
    {
        ArgumentNullException.ThrowIfNull(code);
        return ByWriteCode[code.Code];
    }

    public static Error Of(EventBatchError error)
    {
        ArgumentNullException.ThrowIfNull(error);
        return ByReadCode[error.Code];
    }

    public static Error Of(CourtStreamRefusal refusal) => refusal switch
    {
        CourtStreamRefusal.CourtSessionNotFound => CourtSessionNotFound,
        CourtStreamRefusal.RoundHasCourtSession => RoundHasCourtSession,
        CourtStreamRefusal.RoundCanceled => RoundCanceled,
        _ => throw new ArgumentOutOfRangeException(nameof(refusal), refusal, "Every refusal has an answer."),
    };

    private static Error Validation(string code) => new(Prefix + code, ErrorKind.Validation);

    private static Error Conflict(string code) => new(Prefix + code, ErrorKind.Conflict);

    private static Error Unprocessable(string code) => new(Prefix + code, ErrorKind.Unprocessable);
}
