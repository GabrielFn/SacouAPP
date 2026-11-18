using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;

namespace Sacou.Modules.Matches.Infrastructure;

/// <summary>
/// A write to one court stream: the stream of the route, the group and round it must belong to, whether the
/// round may still get a new stream (only a scheduled one, ADR 0060, D7), the time of the write, and the
/// received text of each envelope by event id, stored as is.
/// </summary>
internal sealed record CourtAppend(
    Guid CourtSessionId,
    Guid GroupId,
    Guid RoundId,
    bool MayCreate,
    DateTimeOffset Now,
    ImmutableDictionary<string, string> EnvelopeTexts)
{
    public override string ToString() => nameof(CourtAppend);
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
}

/// <summary>What <see cref="ICourtStreamStore.AppendAsync"/> did: refused by the stream, refused by the rules, or decided and stored.</summary>
internal sealed record CourtAppendOutcome
{
    private CourtAppendOutcome(CourtStreamRefusal? refusal, Result<CourtWriteDecision, CourtWriteError>? decided)
    {
        Refusal = refusal;
        Decided = decided;
    }

    public CourtStreamRefusal? Refusal { get; }

    /// <summary>Null exactly when <see cref="Refusal"/> is not.</summary>
    public Result<CourtWriteDecision, CourtWriteError>? Decided { get; }

    public static CourtAppendOutcome Refused(CourtStreamRefusal refusal) => new(refusal, decided: null);

    public static CourtAppendOutcome From(Result<CourtWriteDecision, CourtWriteError> decided) => new(refusal: null, decided);

    public override string ToString() => nameof(CourtAppendOutcome);
}

/// <summary>
/// Where the court streams live (ADR 0060, D6 and D13). A stream is always read by its id and checked against the
/// group and round of the route, never trusted by id alone (ADR 0040, D7).
/// </summary>
internal interface ICourtStreamStore
{
    /// <summary>
    /// One READ COMMITTED transaction: creates the stream row when allowed (<c>ON CONFLICT DO NOTHING</c>), locks it
    /// with <c>SELECT ... FOR UPDATE</c>, loads every stored envelope through the parser and the writer of the current
    /// batch, runs <paramref name="decide"/>, and stores the new events, the writer of a new stream and the counters.
    /// Writes to one stream run one after another. Nothing is written on a refusal.
    /// </summary>
    Task<CourtAppendOutcome> AppendAsync(
        CourtAppend append,
        Func<StoredStream, Result<CourtWriteDecision, CourtWriteError>> decide,
        CancellationToken cancellationToken);
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
