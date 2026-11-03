using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.CourtSessions.EventLog;

/// <summary>
/// A parsed event, built only by <see cref="EnvelopeParser"/>. Its properties are exactly the eight
/// fields of <see cref="EnvelopeFields"/>, which a test enforces. Compare two envelopes with
/// <see cref="RawValueEquality"/>, never with <c>Equals</c>, which compares the payload by reference.
/// <c>DeviceId</c> is a random UUID per installation, never a hardware identifier. <c>Batch</c> is the
/// write batch in the stream, stamped when the event is stored; a resend keeps it. <c>Sequence</c>
/// grows per device in the stream, and a gap is not an error. <c>Payload</c> is a copy with keys
/// sorted by UTF-16 code unit at every level and no repeated key.
/// </summary>
internal sealed record EventEnvelope(
    string EventId,
    string CourtSessionId,
    string DeviceId,
    long Batch,
    long Sequence,
    long SchemaVersion,
    string Type,
    RawObject Payload);

/// <summary>Carries only a field name from the schema, never a received key or value.</summary>
internal sealed record EnvelopeError(string Field)
{
    public const string InvalidEnvelopeCode = "invalid-envelope";

    public string Code { get; } = InvalidEnvelopeCode;
}

/// <summary>Carries only a code: the rejected event is identified by the replay.</summary>
internal sealed record EventRejection
{
    public const string EventRejectedCode = "event-rejected";

    public static readonly EventRejection Instance = new();

    private EventRejection()
    {
    }

    public string Code { get; } = EventRejectedCode;
}

internal sealed record ReplayErrorCode
{
    public static readonly ReplayErrorCode StreamMismatch = new("stream-mismatch");
    public static readonly ReplayErrorCode EventIdConflict = new("event-id-conflict");
    public static readonly ReplayErrorCode SequenceConflict = new("sequence-conflict");
    public static readonly ReplayErrorCode UnsupportedSchemaVersion = new("unsupported-schema-version");
    public static readonly ReplayErrorCode UnknownEventType = new("unknown-event-type");
    public static readonly ReplayErrorCode EventRejected = new(EventRejection.EventRejectedCode);
    public static readonly ReplayErrorCode InvalidRevertTarget = new("invalid-revert-target");

    public static readonly ImmutableArray<ReplayErrorCode> All =
    [
        StreamMismatch,
        EventIdConflict,
        SequenceConflict,
        UnsupportedSchemaVersion,
        UnknownEventType,
        EventRejected,
        InvalidRevertTarget,
    ];

    private ReplayErrorCode(string code) => Code = code;

    public string Code { get; }

    public override string ToString() => Code;
}

/// <summary>A code and the id of the event that failed, which the parser proved to be a UUID.</summary>
internal sealed record ReplayError(ReplayErrorCode Code, string EventId);
