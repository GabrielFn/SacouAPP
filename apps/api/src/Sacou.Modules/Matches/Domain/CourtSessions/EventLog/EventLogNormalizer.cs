using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.CourtSessions.EventLog;

/// <summary>
/// Port of <c>normalize-log.ts</c>: sorts a copy of the log, drops exact resends and checks the whole
/// log, inactive events included. Checks go by code and then in canonical order, so the outcome never
/// depends on arrival order.
/// </summary>
internal static class EventLogNormalizer
{
    public static Result<ImmutableArray<EventEnvelope>, ReplayError> Normalize(
        IEnumerable<EventEnvelope> events,
        string courtSessionId)
    {
        // OrderBy is stable, like Array.prototype.sort: only exact resends tie.
        ImmutableArray<EventEnvelope> sorted = [.. events.OrderBy(static envelope => envelope, CanonicalOrder.Instance)];

        var foreign = sorted.FirstOrDefault(envelope =>
            !string.Equals(envelope.CourtSessionId, courtSessionId, StringComparison.Ordinal));
        if (foreign is not null)
        {
            return Failure(ReplayErrorCode.StreamMismatch, foreign);
        }

        var firsts = FirstById(sorted);
        var conflicting = sorted.FirstOrDefault(envelope =>
            !RawValueEquality.HaveSameContent(firsts[envelope.EventId], envelope));
        if (conflicting is not null)
        {
            return Failure(ReplayErrorCode.EventIdConflict, conflicting);
        }

        ImmutableArray<EventEnvelope> unique = [.. sorted.Where(envelope => ReferenceEquals(firsts[envelope.EventId], envelope))];
        var clashing = unique.Skip(1).Zip(unique).FirstOrDefault(pair => HaveSameOrderKey(pair.Second, pair.First)).First;
        if (clashing is not null)
        {
            return Failure(ReplayErrorCode.SequenceConflict, clashing);
        }

        var unsupported = unique.FirstOrDefault(envelope =>
            !EventLogSchema.SupportedEventSchemaVersions.Contains(envelope.SchemaVersion));
        return unsupported is null
            ? Result<ImmutableArray<EventEnvelope>, ReplayError>.Success(unique)
            : Failure(ReplayErrorCode.UnsupportedSchemaVersion, unsupported);
    }

    private static Result<ImmutableArray<EventEnvelope>, ReplayError> Failure(ReplayErrorCode code, EventEnvelope envelope) =>
        Result<ImmutableArray<EventEnvelope>, ReplayError>.Failure(new ReplayError(code, envelope.EventId));

    /// <summary>The first envelope of each id in canonical order: the one a resend is compared with.</summary>
    private static ImmutableDictionary<string, EventEnvelope> FirstById(ImmutableArray<EventEnvelope> sorted)
    {
        var firsts = ImmutableDictionary.CreateBuilder<string, EventEnvelope>(StringComparer.Ordinal);
        foreach (var envelope in sorted)
        {
            firsts.TryAdd(envelope.EventId, envelope);
        }

        return firsts.ToImmutable();
    }

    private static bool HaveSameOrderKey(EventEnvelope previous, EventEnvelope next) =>
        previous.Batch == next.Batch
        && previous.Sequence == next.Sequence
        && string.Equals(previous.DeviceId, next.DeviceId, StringComparison.Ordinal);
}
