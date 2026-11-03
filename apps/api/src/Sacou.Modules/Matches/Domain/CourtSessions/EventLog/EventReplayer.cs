using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.CourtSessions.EventLog;

/// <summary>
/// Port of <c>replay-events.ts</c>. Recalculates the state of a stream deterministically: the outcome,
/// errors included, depends only on the set of events, never on their arrival order. Returns no
/// partial state. Accepts only the output of <see cref="EnvelopeParser"/>, whose limits make the
/// comparison of resends safe. Unlike the TypeScript port, an exception inside an applier is not
/// caught: appliers are total and return a <see cref="Result{TValue, TError}"/> (ADR 0033, D11).
/// </summary>
internal static class EventReplayer
{
    public static Result<ReplayedState<TState>, ReplayError> ReplayEvents<TState>(
        ReplayConfig<TState> config,
        IEnumerable<EventEnvelope> events)
        where TState : notnull
    {
        var timeline = ReplayTimeline(config, events);
        if (timeline.IsFailure)
        {
            return timeline.Forward<ReplayedState<TState>>();
        }

        var entries = timeline.Value.Entries;
        var state = entries.IsEmpty ? config.InitialState : entries[^1].State;
        ImmutableArray<string> activeEventIds = [.. entries.Select(entry => entry.Event.EventId)];
        return Result<ReplayedState<TState>, ReplayError>.Success(new ReplayedState<TState>(state, activeEventIds));
    }

    /// <summary>
    /// Replays a stream like <see cref="ReplayEvents{TState}"/>, keeping the state right after each
    /// active event, in canonical order. The states are the ones of the timeline, never copied.
    /// </summary>
    public static Result<ReplayedTimeline<TState>, ReplayError> ReplayTimeline<TState>(
        ReplayConfig<TState> config,
        IEnumerable<EventEnvelope> events)
        where TState : notnull
    {
        var normalized = EventLogNormalizer.Normalize(events, config.CourtSessionId);
        if (normalized.IsFailure)
        {
            return normalized.Forward<ReplayedTimeline<TState>>();
        }

        var head = Timeline<TState>.Empty;
        foreach (var envelope in normalized.Value)
        {
            var next = string.Equals(envelope.Type, EventLogSchema.RevertedToEventType, StringComparison.Ordinal)
                ? Revert(head, envelope)
                : Apply(head, envelope, config);
            if (next.IsFailure)
            {
                return next.Forward<ReplayedTimeline<TState>>();
            }

            head = next.Value;
        }

        return Result<ReplayedTimeline<TState>, ReplayError>.Success(new ReplayedTimeline<TState>(head.ToEntries()));
    }

    /// <summary>
    /// Only active events are on the timeline, and only earlier ones so far. A target that is missing,
    /// in the future, inactive or another <c>RevertedTo</c> is therefore simply not found.
    /// </summary>
    private static Result<Timeline<TState>, ReplayError> Revert<TState>(Timeline<TState> head, EventEnvelope envelope)
        where TState : notnull
    {
        var target = ReadRevertTarget(envelope.Payload) is { } targetEventId ? head.Find(targetEventId) : null;
        return target is null
            ? Failure<TState>(ReplayErrorCode.InvalidRevertTarget, envelope)
            : Result<Timeline<TState>, ReplayError>.Success(target);
    }

    private static string? ReadRevertTarget(RawObject payload) =>
        payload.Members is [{ Key: EventLogSchema.RevertTargetField, Value: RawString target }]
            ? target.Value
            : null;

    private static Result<Timeline<TState>, ReplayError> Apply<TState>(
        Timeline<TState> head,
        EventEnvelope envelope,
        ReplayConfig<TState> config)
        where TState : notnull
    {
        if (!config.Appliers.TryGetValue(envelope.Type, out var applier))
        {
            return Failure<TState>(ReplayErrorCode.UnknownEventType, envelope);
        }

        var applied = applier(head.StateOr(config.InitialState), envelope);
        return applied.IsSuccess
            ? Result<Timeline<TState>, ReplayError>.Success(head.Push(envelope, applied.Value))
            : Failure<TState>(ReplayErrorCode.EventRejected, envelope);
    }

    private static Result<Timeline<TState>, ReplayError> Failure<TState>(ReplayErrorCode code, EventEnvelope envelope)
        where TState : notnull
        => Result<Timeline<TState>, ReplayError>.Failure(new ReplayError(code, envelope.EventId));
}
