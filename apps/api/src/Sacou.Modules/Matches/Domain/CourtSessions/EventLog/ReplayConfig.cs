using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.CourtSessions.EventLog;

/// <summary>
/// The appliers are a <c>Func</c> and not a delegate of their own, because a declared delegate
/// implements ISerializable, which the domain rule refuses. An applier is pure: it applies the
/// recorded result without recalculating rules and never mutates the state. A rule refusal is a
/// failed <see cref="Result{TValue, TError}"/>, never an exception (ADR 0033, D11).
/// </summary>
internal sealed class ReplayConfig<TState>
    where TState : notnull
{
    public ReplayConfig(
        string courtSessionId,
        TState initialState,
        ImmutableDictionary<string, Func<TState, EventEnvelope, Result<TState, EventRejection>>> appliers)
    {
        CourtSessionId = courtSessionId;
        InitialState = initialState;
        // By UTF-16 code unit whatever comparer came in: "fixtureappended" is not "FixtureAppended".
        Appliers = appliers.WithComparers(StringComparer.Ordinal);
    }

    public string CourtSessionId { get; }

    public TState InitialState { get; }

    public ImmutableDictionary<string, Func<TState, EventEnvelope, Result<TState, EventRejection>>> Appliers { get; }
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
