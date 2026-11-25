using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Writes;

/// <summary>
/// The body of a takeover (ADR 0063, D2): the device that will write, and the batch and the event count
/// the confirmation showed. Checked before any lock is taken.
/// </summary>
internal sealed class CourtTakeoverRequest
{
    public const string DeviceIdField = "deviceId";
    public const string ExpectedBatchField = "expectedBatch";
    public const string ExpectedEventCountField = "expectedEventCount";

    private const long Smallest = 0;

    private CourtTakeoverRequest(string deviceId, long expectedBatch, long expectedEventCount)
    {
        DeviceId = deviceId;
        ExpectedBatch = expectedBatch;
        ExpectedEventCount = expectedEventCount;
    }

    public string DeviceId { get; }

    public long ExpectedBatch { get; }

    public long ExpectedEventCount { get; }

    /// <summary>A lowercase UUID, as in the envelopes, and two integers from zero; the first failing field decides.</summary>
    public static Result<CourtTakeoverRequest, CourtWriteError> Create(string deviceId, long expectedBatch, long expectedEventCount)
    {
        ArgumentNullException.ThrowIfNull(deviceId);
        var invalidField = !LowercaseUuid.IsValid(deviceId) ? DeviceIdField
            : expectedBatch < Smallest ? ExpectedBatchField
            : expectedEventCount < Smallest ? ExpectedEventCountField
            : null;
        return invalidField is null
            ? Result<CourtTakeoverRequest, CourtWriteError>.Success(new CourtTakeoverRequest(deviceId, expectedBatch, expectedEventCount))
            : Result<CourtTakeoverRequest, CourtWriteError>.Failure(new CourtWriteError(CourtWriteErrorCode.TakeoverInvalid, Field: invalidField));
    }

    /// <summary>Never the device id: tied to a member, it never goes to a log.</summary>
    public override string ToString() => nameof(CourtTakeoverRequest);
}

/// <summary>
/// An accepted takeover: the writer of the current batch, new or already the caller, whether a batch
/// was opened, the largest sequence the device has in the stream (0 when it never wrote), and the
/// events stored under the lock, the same read as <c>LastSequence</c> (R98): the snapshot the
/// app imports, even when the pair already writing gets its batch again and the batch began earlier.
/// </summary>
internal sealed record CourtTakeoverDecision(CourtWriter Writer, bool OpensBatch, long LastSequence, long EventCount)
{
    public override string ToString() => nameof(CourtTakeoverDecision);
}

/// <summary>
/// Decides a takeover of the court stream under its lock, with no database and no clock (ADR 0063, D1
/// to D3 and D10). The pair already writing gets its batch again, whatever it expected; a stream that
/// moved since the confirmation, or one at its ceiling of batches, is refused; otherwise the next batch
/// opens for the pair, starting after the events stored so far. Who may take over is the role, checked
/// by the caller; never who writes now.
/// </summary>
internal static class CourtTakeover
{
    private const long OneBatch = 1;

    public static Result<CourtTakeoverDecision, CourtWriteError> Decide(IWrittenStream stored, CourtTakeoverRequest request, string callerMemberId)
    {
        ArgumentNullException.ThrowIfNull(stored);
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(callerMemberId);
        if (stored.Writer is not { } writer)
        {
            throw new ArgumentException("A takeover needs a stored stream; the store answers one that does not exist.", nameof(stored));
        }

        var lastSequence = stored.LastSequenceOf(request.DeviceId);
        var eventCount = stored.EventCount;
        if (stored.IsCurrentWriter(request.DeviceId, callerMemberId))
        {
            return Accept(new CourtTakeoverDecision(writer, OpensBatch: false, lastSequence, eventCount));
        }

        if (writer.Batch >= CourtStreamLimits.MaxWritersPerStream)
        {
            return Refuse(new CourtWriteError(CourtWriteErrorCode.LimitReached, Limit: StreamLimitNames.WritersPerStream));
        }

        if (request.ExpectedBatch != writer.Batch || request.ExpectedEventCount != eventCount)
        {
            return Refuse(new CourtWriteError(CourtWriteErrorCode.StreamChanged));
        }

        var next = new CourtWriter(writer.Batch + OneBatch, request.DeviceId, callerMemberId, eventCount);
        return Accept(new CourtTakeoverDecision(next, OpensBatch: true, lastSequence, eventCount));
    }

    private static Result<CourtTakeoverDecision, CourtWriteError> Accept(CourtTakeoverDecision decision) =>
        Result<CourtTakeoverDecision, CourtWriteError>.Success(decision);

    private static Result<CourtTakeoverDecision, CourtWriteError> Refuse(CourtWriteError error) =>
        Result<CourtTakeoverDecision, CourtWriteError>.Failure(error);
}
