using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.CourtSessions.EventLog;

/// <summary>
/// Pure: applies the recorded result without recalculating rules and never mutates the state. A
/// rule refusal is a failed <see cref="Result{TValue, TError}"/>, never an exception (ADR 0033, D11).
/// </summary>
internal delegate Result<TState, EventRejection> EventApplier<TState>(TState state, EventEnvelope envelope)
    where TState : notnull;

internal sealed class ReplayConfig<TState>
    where TState : notnull
{
    public ReplayConfig(
        string courtSessionId,
        TState initialState,
        ImmutableDictionary<string, EventApplier<TState>> appliers)
    {
        CourtSessionId = courtSessionId;
        InitialState = initialState;
        // By UTF-16 code unit whatever comparer came in: "fixtureappended" is not "FixtureAppended".
        Appliers = appliers.WithComparers(StringComparer.Ordinal);
    }

    public string CourtSessionId { get; }

    public TState InitialState { get; }

    public ImmutableDictionary<string, EventApplier<TState>> Appliers { get; }
}

/// <summary>The last state and the events whose effects are in it, in canonical order. Never lists a <c>RevertedTo</c>.</summary>
internal sealed record ReplayedState<TState>(TState State, ImmutableArray<string> ActiveEventIds)
    where TState : notnull;

/// <summary>An active event and the state right after it.</summary>
internal sealed record TimelineEntry<TState>(EventEnvelope Event, TState State)
    where TState : notnull;

/// <summary>The active events in canonical order, each with its state. Never lists a <c>RevertedTo</c>.</summary>
internal sealed record ReplayedTimeline<TState>(ImmutableArray<TimelineEntry<TState>> Entries)
    where TState : notnull;
