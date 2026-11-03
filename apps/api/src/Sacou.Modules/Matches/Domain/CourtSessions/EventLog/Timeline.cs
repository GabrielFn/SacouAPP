using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.CourtSessions.EventLog;

/// <summary>
/// The active timeline of a replay, as an immutable linked list: going back only moves the head, so
/// states are never copied. Every node a revert walks leaves the timeline, which keeps the whole
/// replay linear. All walks are loops, so a long chain cannot overflow the stack.
/// </summary>
internal sealed class Timeline<TState>
    where TState : notnull
{
    public static readonly Timeline<TState> Empty = new(head: null);

    private readonly Node? _head;

    private Timeline(Node? head) => _head = head;

    public Timeline<TState> Push(EventEnvelope envelope, TState state) => new(new Node(envelope, state, _head));

    public TState StateOr(TState initialState) => _head is null ? initialState : _head.State;

    /// <summary>The timeline as it was right after that active event, or null when it is not active.</summary>
    public Timeline<TState>? Find(string eventId)
    {
        for (var node = _head; node is not null; node = node.Previous)
        {
            if (string.Equals(node.Envelope.EventId, eventId, StringComparison.Ordinal))
            {
                return new Timeline<TState>(node);
            }
        }

        return null;
    }

    /// <summary>The active events in canonical order, each with the state right after it.</summary>
    public ImmutableArray<TimelineEntry<TState>> ToEntries()
    {
        var entries = ImmutableArray.CreateBuilder<TimelineEntry<TState>>();
        for (var node = _head; node is not null; node = node.Previous)
        {
            entries.Add(new TimelineEntry<TState>(node.Envelope, node.State));
        }

        entries.Reverse();
        return entries.ToImmutable();
    }

    /// <summary>A class, not a record: a generated Equals or ToString would recurse down the chain.</summary>
    private sealed class Node(EventEnvelope envelope, TState state, Node? previous)
    {
        public EventEnvelope Envelope { get; } = envelope;

        public TState State { get; } = state;

        public Node? Previous { get; } = previous;
    }
}
