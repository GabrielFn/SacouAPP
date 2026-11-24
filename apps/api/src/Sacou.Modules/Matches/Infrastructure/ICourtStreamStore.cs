using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;

namespace Sacou.Modules.Matches.Infrastructure;

/// <summary>
/// A write to one court stream: the stream of the route, the group and round it must belong to, whether the
/// round may still get a new stream (only a scheduled one, ADR 0060, D7), the time of the write, and the
/// received text of each envelope by event id, stored as is; and the device and the member who write, so a phone
/// that does not write the current batch is refused before any envelope is read (ADR 0081).
/// </summary>
internal sealed record CourtAppend(
    Guid CourtSessionId,
    Guid GroupId,
    Guid RoundId,
    bool MayCreate,
    DateTimeOffset Now,
    ImmutableDictionary<string, string> EnvelopeTexts,
    string DeviceId,
    string CallerMemberId)
{
    public override string ToString() => nameof(CourtAppend);
}

/// <summary>
/// The rules of a write the store runs under the lock: the refusal of a phone that does not write the current batch,
/// asked with no envelope, then the whole decision over the stored stream (ADR 0081).
/// </summary>
internal sealed record CourtAppendRules(
    Func<IWrittenStream, CourtWriteError?> RefuseWriter,
    Func<StoredStream, Result<CourtWriteDecision, CourtWriteError>> Decide)
{
    public override string ToString() => nameof(CourtAppendRules);
}

/// <summary>
/// How a write went under the lock, for its log line (ADR 0081): the time the lock was held and how the snapshot of
/// the stream was found. Times and closed words only.
/// </summary>
internal sealed record CourtAppendTrace(long LockedMs, string Snapshot)
{
    public const string NoSnapshot = "none";
}

/// <summary>Why the stream itself refused, before any rule of the write ran.</summary>
internal enum CourtStreamRefusal
{
    /// <summary>The stream exists for another round or group: the same answer as a stream that does not exist.</summary>
    CourtSessionNotFound,

    /// <summary>The round already has another stream (one court per round, question 70).</summary>
    RoundHasCourtSession,

    /// <summary>A canceled round never gets a new stream; an existing one goes on.</summary>
    RoundCanceled,

    /// <summary>The caller lost <c>WriteCourt</c> between the access filter and the lock (ADR 0063, D4).</summary>
    Forbidden,

    /// <summary>The snapshot of the stream could not be built in time, every build busy (ADR 0081): 503, try again.</summary>
    Busy,
}

/// <summary>
/// What a call under the stream's lock did (<see cref="ICourtStreamStore.AppendAsync"/> or
/// <see cref="ICourtStreamStore.TakeOverAsync"/>): refused by the stream, refused by the rules, or decided and stored.
/// </summary>
internal sealed record CourtStreamOutcome<TDecision>
    where TDecision : class
{
    private CourtStreamOutcome(CourtStreamRefusal? refusal, Result<TDecision, CourtWriteError>? decided)
    {
        Refusal = refusal;
        Decided = decided;
    }

    public CourtStreamRefusal? Refusal { get; }

    /// <summary>Null exactly when <see cref="Refusal"/> is not.</summary>
    public Result<TDecision, CourtWriteError>? Decided { get; }

    /// <summary>How a write went under the lock, for its log; null for a takeover and for a refusal before the lock.</summary>
    public CourtAppendTrace? Trace { get; init; }

    public static CourtStreamOutcome<TDecision> Refused(CourtStreamRefusal refusal) => new(refusal, decided: null);

    public static CourtStreamOutcome<TDecision> From(Result<TDecision, CourtWriteError> decided) => new(refusal: null, decided);

    public override string ToString() => nameof(CourtStreamOutcome<TDecision>);
}

/// <summary>
/// A takeover of one stream (ADR 0063, D1 and D4): the stream of the route, the group and round it must belong to,
/// the time of the takeover, whether the caller still holds <c>WriteCourt</c>, asked again under the lock, and the
/// device that will write, whose largest stored sequence the answer carries.
/// </summary>
internal sealed record CourtTakeoverCall(
    Guid CourtSessionId,
    Guid GroupId,
    Guid RoundId,
    DateTimeOffset Now,
    Func<CancellationToken, Task<bool>> StillMayWrite,
    string DeviceId)
{
    public override string ToString() => nameof(CourtTakeoverCall);
}

/// <summary>
/// Where the court streams live (ADR 0060, D6 and D13). A stream is always read by its id and checked against the
/// group and round of the route, never trusted by id alone (ADR 0040, D7).
/// </summary>
internal interface ICourtStreamStore
{
    /// <summary>
    /// Brings the snapshot of the stream up to date outside any lock, for its writer only (ADR 0081); then one READ
    /// COMMITTED transaction: creates the stream row when allowed (<c>ON CONFLICT DO NOTHING</c>), locks it with
    /// <c>SELECT ... FOR UPDATE</c>, reads the writers, refuses a phone that does not write the current batch before
    /// any envelope, reads only the envelopes after the snapshot, runs the decision, and stores the new events, the
    /// writer of a new stream and the counters. Writes to one stream run one after another. Nothing is written on a
    /// refusal, and the snapshot with the new events is kept only after the commit.
    /// </summary>
    Task<CourtStreamOutcome<CourtWriteDecision>> AppendAsync(
        CourtAppend append,
        CourtAppendRules rules,
        CancellationToken cancellationToken);

    /// <summary>
    /// One READ COMMITTED transaction (ADR 0063, D1 and D4): locks the stream row with the same
    /// <c>SELECT ... FOR UPDATE</c> as a write, asks again whether the caller may write the court, reads the writers,
    /// the count and the largest sequence of the device, never an envelope (ADR 0081), runs <paramref name="decide"/>,
    /// and stores the writer of the new batch and the new current batch. Nothing is written on a refusal nor when the
    /// caller already writes the current batch.
    /// </summary>
    Task<CourtStreamOutcome<CourtTakeoverDecision>> TakeOverAsync(
        CourtTakeoverCall call,
        Func<IWrittenStream, Result<CourtTakeoverDecision, CourtWriteError>> decide,
        CancellationToken cancellationToken);
}

/// <summary>
/// The summary of the stream of a round (ADR 0063, D5): its batch and count, who writes the current batch and since
/// when (server time), the time of the last stored event, and the stored scoreboard, null with no open match.
/// Never a device id.
/// </summary>
internal sealed record CourtSessionSummary(
    Guid CourtSessionId,
    long CurrentBatch,
    int EventCount,
    Guid WriterMemberId,
    DateTimeOffset WriterSince,
    DateTimeOffset? LastEventAt,
    CourtScoreboardRow? Scoreboard)
{
    public override string ToString() => nameof(CourtSessionSummary);
}

/// <summary>The stored scoreboard columns of a stream with an open match (ADR 0063, D6).</summary>
internal sealed record CourtScoreboardRow(Guid MatchId, int SetNumber, int PointsA, int PointsB, int SetsA, int SetsB);

/// <summary>One page of the stored stream: each envelope as stored, the position of the last one, and the stream count.</summary>
internal sealed record CourtEventPage(ImmutableArray<string> Envelopes, long LastPosition, int EventCount)
{
    public override string ToString() => nameof(CourtEventPage);
}

/// <summary>The reads of a stream for whoever may take it over (ADR 0063, D5 and D7). No lock: each read is one snapshot.</summary>
internal interface ICourtSessionReader
{
    /// <summary>The stream of the round in the group; null when the round has none.</summary>
    Task<CourtSessionSummary?> FindSummaryAsync(Guid groupId, Guid roundId, CancellationToken cancellationToken);

    /// <summary>
    /// The envelopes after <paramref name="after"/>, in position order, at most <paramref name="maxEvents"/> and
    /// <paramref name="maxBytes"/> (the first one always fits); null when the stream is not of this group and round.
    /// </summary>
    Task<CourtEventPage?> ListEventsAsync(
        Guid groupId, Guid roundId, Guid courtSessionId, long after, int maxEvents, long maxBytes, CancellationToken cancellationToken);
}

/// <summary>The stored stream in arrival order, through the same parser as a request, for the projections (E3.9). No lock.</summary>
internal interface ICourtEventStore
{
    /// <summary>Empty for a stream that does not exist.</summary>
    Task<ImmutableArray<StreamEvent>> LoadAsync(Guid courtSessionId, CancellationToken cancellationToken);
}

/// <summary>One batch a person wrote, for the personal data export (ADR 0060, D16).</summary>
internal sealed record AccountCourtWrite(Guid CourtSessionId, Guid RoundId, long Batch, Guid DeviceId, DateTimeOffset StartedAt);

/// <summary>The batches written by a set of member ids, by the index on <c>member_id</c>.</summary>
internal interface ICourtWriterReader
{
    /// <summary>Oldest first, then by stream and batch; empty for no member.</summary>
    Task<IReadOnlyList<AccountCourtWrite>> ListOfMembersAsync(IReadOnlyCollection<Guid> members, CancellationToken cancellationToken);
}

/// <summary>
/// A stored envelope the parser refuses: the database was changed outside the API. A 500 with nothing of the row in
/// the body or the log, only the stream id (fails closed, ADR 0060, D13).
/// </summary>
internal sealed class CorruptCourtStreamException(Guid courtSessionId)
    : Exception($"A stored envelope of court stream {courtSessionId} does not parse.");
