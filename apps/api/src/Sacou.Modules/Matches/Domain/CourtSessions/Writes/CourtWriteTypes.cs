using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Writes;

/// <summary>A parsed envelope and the number of bytes it was received or stored with.</summary>
internal sealed record StreamEvent(EventEnvelope Envelope, long ByteCount)
{
    /// <summary>Never the envelope: its device id and payload are received content (ADR 0060, D15).</summary>
    public override string ToString() => nameof(StreamEvent);
}

/// <summary>
/// Who writes a batch of the stream: a device of one installation and the member who holds it (ADR 0060, D4),
/// and how many events the stream had when the batch began, which a takeover answers (ADR 0063, D1).
/// </summary>
internal sealed record CourtWriter(long Batch, string DeviceId, string MemberId, long EventsBefore)
{
    /// <summary>Only the batch: a device id tied to a member id never goes to a log.</summary>
    public override string ToString() => nameof(CourtWriter);
}

/// <summary>
/// What a write needs besides the stream: the member who calls, the member ids of the group the route
/// names that the request references (ADR 0060, D11), and the versions this server replays.
/// </summary>
internal sealed record CourtWriteContext(
    string CallerMemberId,
    ImmutableHashSet<string> GroupMemberIds,
    ImmutableArray<long> SupportedRulesVersions,
    ImmutableArray<long> SupportedFormationsVersions)
{
    public override string ToString() => nameof(CourtWriteContext);
}

/// <summary>
/// An accepted write: the events to store, in order, the largest sequence of the device after it, how
/// many were exact resends, the writer of the batch, new when the write creates the stream, and the
/// scoreboard of the stream after the new events (ADR 0063, D6). The scoreboard is null with no open
/// match, and on a pure resend, which stores nothing and so leaves the stored scoreboard as it is.
/// </summary>
internal sealed record CourtWriteDecision(
    ImmutableArray<StreamEvent> NewEvents,
    long LastSequence,
    int Duplicates,
    CourtWriter Writer,
    bool CreatesStream,
    CourtScoreboard? Scoreboard)
{
    public override string ToString() => nameof(CourtWriteDecision);
}

/// <summary>Why a write was refused, by closed list. The HTTP layer adds the <c>matches.</c> prefix.</summary>
internal sealed record CourtWriteErrorCode
{
    public static readonly CourtWriteErrorCode BatchInvalid = new("batch-invalid");
    public static readonly CourtWriteErrorCode StreamMismatch = new("stream-mismatch");
    public static readonly CourtWriteErrorCode UnsupportedSchemaVersion = new("unsupported-schema-version");
    public static readonly CourtWriteErrorCode UnknownEventType = new("unknown-event-type");
    public static readonly CourtWriteErrorCode NotTheWriter = new("not-the-writer");
    public static readonly CourtWriteErrorCode BatchMismatch = new("batch-mismatch");
    public static readonly CourtWriteErrorCode EventIdConflict = new("event-id-conflict");
    public static readonly CourtWriteErrorCode SequenceGap = new("sequence-gap");
    public static readonly CourtWriteErrorCode SequenceConflict = new("sequence-conflict");
    public static readonly CourtWriteErrorCode LimitReached = new("limit-reached");
    public static readonly CourtWriteErrorCode EventRejected = new("event-rejected");
    public static readonly CourtWriteErrorCode EventImplausible = new("event-implausible");
    public static readonly CourtWriteErrorCode MemberNotInGroup = new("member-not-in-group");
    public static readonly CourtWriteErrorCode TakeoverInvalid = new("takeover-invalid");
    public static readonly CourtWriteErrorCode StreamChanged = new("stream-changed");

    public static readonly ImmutableArray<CourtWriteErrorCode> All =
    [
        BatchInvalid,
        StreamMismatch,
        UnsupportedSchemaVersion,
        UnknownEventType,
        NotTheWriter,
        BatchMismatch,
        EventIdConflict,
        SequenceGap,
        SequenceConflict,
        LimitReached,
        EventRejected,
        EventImplausible,
        MemberNotInGroup,
        TakeoverInvalid,
        StreamChanged,
    ];

    private CourtWriteErrorCode(string code) => Code = code;

    public string Code { get; }

    public override string ToString() => Code;
}

/// <summary>
/// A refusal. Every detail is from a closed list, a number, or an event id the parser proved to be a
/// UUID; never a member id nor received content (ADR 0060, D15). A refused former writer learns the
/// current batch and its own last stored sequence (ADR 0063, D8).
/// </summary>
internal sealed record CourtWriteError(
    CourtWriteErrorCode Code,
    string? EventId = null,
    string? Reason = null,
    long? ExpectedSequence = null,
    string? Limit = null,
    long? CurrentBatch = null,
    long? LastSequence = null,
    string? Field = null)
{
    public override string ToString() => $"{nameof(CourtWriteError)}({Code})";
}
