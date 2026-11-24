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
            var next = Step(head, envelope, config);
            if (next.IsFailure)
            {
                return next.Forward<ReplayedTimeline<TState>>();
            }

            head = next.Value;
        }

        return Result<ReplayedTimeline<TState>, ReplayError>.Success(new ReplayedTimeline<TState>(head.ToEntries()));
    }

    /// <summary>
    /// Replays a stream like <see cref="ReplayTimeline{TState}"/>, also keeping the timeline right
    /// before each event <paramref name="isTracked"/> picks, in canonical order. A tracked event that
    /// a later <c>RevertedTo</c> undoes keeps its step: what it met is what a check needs.
    /// </summary>
    public static Result<ReplayedSteps<TState>, ReplayError> ReplaySteps<TState>(
        ReplayConfig<TState> config,
        IEnumerable<EventEnvelope> events,
        Func<EventEnvelope, bool> isTracked)
        where TState : notnull
    {
        var normalized = EventLogNormalizer.Normalize(events, config.CourtSessionId);
        if (normalized.IsFailure)
        {
            return normalized.Forward<ReplayedSteps<TState>>();
        }

        return StepsFrom(Timeline<TState>.Empty, normalized.Value, config, isTracked);
    }

    /// <summary>
    /// Continues the replay of a stored stream with new events, from the timeline <paramref name="checkpoint"/>
    /// already holds, with the same outcome as <see cref="ReplaySteps{TState}"/> over the stored events and the new
    /// ones (ADR 0081). Only the new events are normalized, which is equivalent when every new event comes after every
    /// stored one by order key, names none of their ids, and is of the same stream: then the stored events are a prefix
    /// of the canonical order and add no error of the normalizer. Otherwise, or when the stored events do not replay,
    /// it fails closed into the replay of the whole stream. <paramref name="isTracked"/> is meant for new events.
    /// </summary>
    public static Result<ReplayedSteps<TState>, ReplayError> ContinueSteps<TState>(
        ReplayConfig<TState> config,
        IReplayCheckpoint<TState> checkpoint,
        IEnumerable<EventEnvelope> newEvents,
        Func<EventEnvelope, bool> isTracked)
        where TState : notnull
    {
        ArgumentNullException.ThrowIfNull(checkpoint);
        ImmutableArray<EventEnvelope> news = [.. newEvents];
        if (checkpoint.Head is not { } head || !Follows(config.CourtSessionId, checkpoint, news))
        {
            return ReplaySteps(config, checkpoint.StoredEvents.Concat(news), isTracked);
        }

        var normalized = EventLogNormalizer.Normalize(news, config.CourtSessionId);
        return normalized.IsFailure
            ? normalized.Forward<ReplayedSteps<TState>>()
            : StepsFrom(head, normalized.Value, config, isTracked);
    }

    /// <summary>
    /// The precondition of <see cref="ContinueSteps{TState}"/> on order, ids and stream, whatever the head holds;
    /// trivially true over a stream with no event, and with no new event.
    /// </summary>
    public static bool Follows<TState>(string courtSessionId, IReplayCheckpoint<TState> checkpoint, ImmutableArray<EventEnvelope> news)
        where TState : notnull
    {
        ArgumentNullException.ThrowIfNull(checkpoint);
        if (checkpoint.LastEvent is not { } last || news.IsEmpty)
        {
            return true;
        }

        var first = news.Min(CanonicalOrder.Instance)!;
        return string.Equals(last.CourtSessionId, courtSessionId, StringComparison.Ordinal)
            && CanonicalOrder.CompareOrderKeys(last, first) < 0
            && !news.Any(envelope => checkpoint.IsStored(envelope.EventId));
    }

    private static Result<ReplayedSteps<TState>, ReplayError> StepsFrom<TState>(
        Timeline<TState> head,
        ImmutableArray<EventEnvelope> normalized,
        ReplayConfig<TState> config,
        Func<EventEnvelope, bool> isTracked)
        where TState : notnull
    {
        var steps = ImmutableArray.CreateBuilder<ReplayStep<TState>>();
        foreach (var envelope in normalized)
        {
            if (isTracked(envelope))
            {
                steps.Add(new ReplayStep<TState>(envelope, head));
            }

            var next = Step(head, envelope, config);
            if (next.IsFailure)
            {
                return next.Forward<ReplayedSteps<TState>>();
            }

            head = next.Value;
        }

        return Result<ReplayedSteps<TState>, ReplayError>.Success(new ReplayedSteps<TState>(head, steps.ToImmutable()));
    }

    private static Result<Timeline<TState>, ReplayError> Step<TState>(
        Timeline<TState> head,
        EventEnvelope envelope,
        ReplayConfig<TState> config)
        where TState : notnull
        => string.Equals(envelope.Type, EventLogSchema.RevertedToEventType, StringComparison.Ordinal)
            ? Revert(head, envelope)
            : Apply(head, envelope, config);

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
