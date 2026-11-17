using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Writes;

/// <summary>
/// The events of one request, checked for coherence before any lock is taken (ADR 0060, D8 step 4):
/// the stream of the route, one device and one batch, sequences one after the other with no repeated
/// event id, a supported schema version, and a type of the closed list. The first failing check
/// decides, in that order, and inside each check the first event in request order.
/// </summary>
internal sealed class CourtWriteRequest
{
    private const long OneStep = 1;

    /// <summary>The score catalog and the revert: any other type is refused before the replay.</summary>
    public static readonly ImmutableArray<string> KnownEventTypes =
        [.. ScoreEventTypes.All, EventLogSchema.RevertedToEventType];

    private CourtWriteRequest(ImmutableArray<StreamEvent> events)
    {
        Events = events;
    }

    /// <summary>In request order, which is sequence order.</summary>
    public ImmutableArray<StreamEvent> Events { get; }

    public string DeviceId => Events[0].Envelope.DeviceId;

    public long Batch => Events[0].Envelope.Batch;

    public static Result<CourtWriteRequest, CourtWriteError> Create(
        string routeCourtSessionId,
        ImmutableArray<StreamEvent> events,
        ImmutableArray<long> supportedSchemaVersions)
    {
        if (events.Length is < CourtStreamLimits.MinEventsPerRequest or > CourtStreamLimits.MaxEventsPerRequest)
        {
            return Refuse(CourtWriteErrorCode.BatchInvalid);
        }

        ImmutableArray<EventEnvelope> envelopes = [.. events.Select(item => item.Envelope)];
        if (envelopes.FirstOrDefault(envelope =>
                !string.Equals(envelope.CourtSessionId, routeCourtSessionId, StringComparison.Ordinal)) is { } foreign)
        {
            return Refuse(CourtWriteErrorCode.StreamMismatch, foreign.EventId);
        }

        if (!IsOneOrderedBatch(envelopes))
        {
            return Refuse(CourtWriteErrorCode.BatchInvalid);
        }

        if (envelopes.FirstOrDefault(envelope => !supportedSchemaVersions.Contains(envelope.SchemaVersion)) is { } unsupported)
        {
            return Refuse(CourtWriteErrorCode.UnsupportedSchemaVersion, unsupported.EventId);
        }

        return envelopes.FirstOrDefault(envelope => !KnownEventTypes.Contains(envelope.Type, StringComparer.Ordinal)) is { } unknown
            ? Refuse(CourtWriteErrorCode.UnknownEventType, unknown.EventId)
            : Result<CourtWriteRequest, CourtWriteError>.Success(new CourtWriteRequest(events));
    }

    /// <summary>One device, one batch, each sequence the previous plus one, and no event id twice.</summary>
    private static bool IsOneOrderedBatch(ImmutableArray<EventEnvelope> envelopes)
    {
        var first = envelopes[0];
        var isOneDeviceAndBatch = envelopes.All(envelope =>
            string.Equals(envelope.DeviceId, first.DeviceId, StringComparison.Ordinal) && envelope.Batch == first.Batch);
        var isContiguous = envelopes.Skip(1).Zip(envelopes).All(pair => pair.First.Sequence == pair.Second.Sequence + OneStep);
        var hasUniqueIds = envelopes.Select(envelope => envelope.EventId).Distinct(StringComparer.Ordinal).Count() == envelopes.Length;
        return isOneDeviceAndBatch && isContiguous && hasUniqueIds;
    }

    private static Result<CourtWriteRequest, CourtWriteError> Refuse(CourtWriteErrorCode code, string? eventId = null) =>
        Result<CourtWriteRequest, CourtWriteError>.Failure(new CourtWriteError(code, eventId));

    public override string ToString() => nameof(CourtWriteRequest);
}
