using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.Appliers;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Writes;

/// <summary>
/// Decides a write to the court stream under its lock, with no database and no clock (ADR 0060, D8
/// steps 5 to 9). Fails closed, the first error deciding: the writer and its batch, exact resends and
/// conflicts by event id, the sequence of the device, the ceilings, the replay of the whole stream with
/// the new events, their plausibility, and the members of the group. All or nothing: a refusal stores
/// no event. A pure resend is accepted with no new event.
/// </summary>
internal static class CourtWriteRules
{
    private const long OneStep = 1;

    public static Result<CourtWriteDecision, CourtWriteError> Decide(
        StoredStream stored,
        CourtWriteRequest request,
        CourtWriteContext context)
    {
        var writer = CheckWriter(stored, request, context);
        if (writer.IsFailure)
        {
            return writer.Forward<CourtWriteDecision>();
        }

        var conflicting = request.Events.FirstOrDefault(item =>
            stored.Find(item.Envelope.EventId) is { } same && !RawValueEquality.HaveSameContent(same.Envelope, item.Envelope));
        if (conflicting is not null)
        {
            return Refuse(new CourtWriteError(CourtWriteErrorCode.EventIdConflict, conflicting.Envelope.EventId));
        }

        ImmutableArray<StreamEvent> newEvents = [.. request.Events.Where(item => stored.Find(item.Envelope.EventId) is null)];
        var duplicates = request.Events.Length - newEvents.Length;
        var lastSequence = stored.LastSequenceOf(request.DeviceId);
        if (newEvents.IsEmpty)
        {
            return Accept(new CourtWriteDecision([], lastSequence, duplicates, writer.Value, CreatesStream: false, Scoreboard: null));
        }

        var decided = DecideNewEvents(stored, newEvents, lastSequence, context);
        return decided.IsFailure
            ? decided.Forward<CourtWriteDecision>()
            : Accept(new CourtWriteDecision(
                newEvents,
                newEvents[^1].Envelope.Sequence,
                duplicates,
                writer.Value,
                CreatesStream: stored.Writer is null,
                CourtScoreboard.From(decided.Value)));
    }

    /// <summary>The sequence, the ceilings, the replay with its plausibility, then the members; the state after them.</summary>
    private static Result<CourtSessionState, CourtWriteError> DecideNewEvents(
        StoredStream stored,
        ImmutableArray<StreamEvent> newEvents,
        long lastSequence,
        CourtWriteContext context)
    {
        var refusal = CheckSequence(newEvents[0].Envelope, lastSequence) ?? StreamLimitCheck.FindExceeded(stored, newEvents);
        if (refusal is not null)
        {
            return Result<CourtSessionState, CourtWriteError>.Failure(refusal);
        }

        var replayed = Replay(stored, newEvents, context);
        return replayed.IsSuccess && FindForeignMember(newEvents, context) is { } foreign
            ? Result<CourtSessionState, CourtWriteError>.Failure(foreign)
            : replayed;
    }

    /// <summary>
    /// The first write creates the stream with batch 1, written by the device and the member of the
    /// request. Afterwards only that device, held by that member, writes, and only in the current batch.
    /// </summary>
    private static Result<CourtWriter, CourtWriteError> CheckWriter(StoredStream stored, CourtWriteRequest request, CourtWriteContext context)
    {
        if (stored.Writer is not { } writer)
        {
            return request.Batch == CourtStreamLimits.FirstBatch
                ? Result<CourtWriter, CourtWriteError>.Success(
                    new CourtWriter(CourtStreamLimits.FirstBatch, request.DeviceId, context.CallerMemberId, EventsBefore: 0))
                : Result<CourtWriter, CourtWriteError>.Failure(new CourtWriteError(CourtWriteErrorCode.BatchMismatch));
        }

        if (!stored.IsCurrentWriter(request.DeviceId, context.CallerMemberId))
        {
            return Result<CourtWriter, CourtWriteError>.Failure(NotTheWriter(stored, writer, request.DeviceId, context.CallerMemberId));
        }

        return request.Batch == writer.Batch
            ? Result<CourtWriter, CourtWriteError>.Success(writer)
            : Result<CourtWriter, CourtWriteError>.Failure(new CourtWriteError(CourtWriteErrorCode.BatchMismatch));
    }

    /// <summary>
    /// The current batch, never who writes it; the largest stored sequence of the device only when this
    /// pair wrote an earlier batch, so a phone that lost the court tells what got in (ADR 0063, D8). The
    /// batch of the request does not matter: the old phone is refused for the takeover the server
    /// recorded, never for its clock nor for a forged batch.
    /// </summary>
    private static CourtWriteError NotTheWriter(StoredStream stored, CourtWriter writer, string deviceId, string memberId) =>
        new(
            CourtWriteErrorCode.NotTheWriter,
            CurrentBatch: writer.Batch,
            LastSequence: stored.PreviousWriterOf(deviceId, memberId) is null ? null : stored.LastSequenceOf(deviceId));

    /// <summary>
    /// The first new event follows the largest sequence of the device, as in the local log. Ahead is a
    /// gap the phone fills by sending again from the expected one; behind, with an unknown event id, is
    /// another phone with the same device id.
    /// </summary>
    private static CourtWriteError? CheckSequence(EventEnvelope first, long lastSequence)
    {
        var expected = lastSequence + OneStep;
        return first.Sequence > expected ? new CourtWriteError(CourtWriteErrorCode.SequenceGap, first.EventId, ExpectedSequence: expected)
            : first.Sequence < expected ? new CourtWriteError(CourtWriteErrorCode.SequenceConflict, first.EventId)
            : null;
    }

    /// <summary>
    /// The replay of the whole stream, then the plausibility of each new event on the timeline right
    /// before it. The state at the end gives the scoreboard. A <c>RevertedTo</c> may name any earlier
    /// event, of this batch or of an earlier one: whoever writes undoes any point (ADR 0063, D9).
    /// </summary>
    private static Result<CourtSessionState, CourtWriteError> Replay(StoredStream stored, ImmutableArray<StreamEvent> newEvents, CourtWriteContext context)
    {
        var newIds = newEvents.Select(item => item.Envelope.EventId).ToImmutableHashSet(StringComparer.Ordinal);
        var replayed = EventReplayer.ReplaySteps(
            ScoreAppliers.Config(newEvents[0].Envelope.CourtSessionId),
            stored.Events.Concat(newEvents).Select(item => item.Envelope),
            envelope => newIds.Contains(envelope.EventId));
        if (replayed.IsFailure)
        {
            return Result<CourtSessionState, CourtWriteError>.Failure(
                new CourtWriteError(CourtWriteErrorCode.EventRejected, replayed.Error.EventId, Reason: replayed.Error.Code.Code));
        }

        var implausible = replayed.Value.Steps
            .Select(step => EventPlausibility.Check(step.Event, step.Before, context) is { } reason
                ? new CourtWriteError(CourtWriteErrorCode.EventImplausible, step.Event.EventId, Reason: reason)
                : null)
            .FirstOrDefault(error => error is not null);
        return implausible is null
            ? Result<CourtSessionState, CourtWriteError>.Success(replayed.Value.Head.StateOr(CourtSessionState.Initial))
            : Result<CourtSessionState, CourtWriteError>.Failure(implausible);
    }

    /// <summary>Never names the member: only the event that names it (ADR 0060, D15).</summary>
    private static CourtWriteError? FindForeignMember(ImmutableArray<StreamEvent> newEvents, CourtWriteContext context)
    {
        var foreign = newEvents.FirstOrDefault(item =>
            CourtEventMembers.Collect(item.Envelope).Any(memberId => !context.GroupMemberIds.Contains(memberId)));
        return foreign is null ? null : new CourtWriteError(CourtWriteErrorCode.MemberNotInGroup, foreign.Envelope.EventId);
    }

    private static Result<CourtWriteDecision, CourtWriteError> Accept(CourtWriteDecision decision) =>
        Result<CourtWriteDecision, CourtWriteError>.Success(decision);

    private static Result<CourtWriteDecision, CourtWriteError> Refuse(CourtWriteError error) =>
        Result<CourtWriteDecision, CourtWriteError>.Failure(error);
}
