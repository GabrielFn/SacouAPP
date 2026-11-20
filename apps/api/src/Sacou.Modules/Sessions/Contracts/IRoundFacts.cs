using Sacou.Modules.Groups.Contracts;

namespace Sacou.Modules.Sessions.Contracts;

/// <summary>
/// What the projections of the after-game need of the rounds of a group (E3.9, ADR 0071): whether each round still
/// counts, when it started, and its resolved summary leaves. A round is always read by <c>(groupId, roundId)</c>.
/// </summary>
public interface IRoundFacts
{
    /// <summary>The round of that group, or null when the group has no such round (a round of another group included).</summary>
    Task<RoundFacts?> FindAsync(Guid groupId, Guid roundId, CancellationToken cancellationToken);

    /// <summary>Every round of the group, earliest first, then by id; empty for a group that does not exist.</summary>
    Task<IReadOnlyList<RoundFacts>> ListAsync(Guid groupId, CancellationToken cancellationToken);
}

/// <summary>
/// A round as the projections read it: its state, its start (an instant, and the local date in the round's time
/// zone, <c>America/Sao_Paulo</c>, for the season), and the summary leaves of its resolved settings.
/// </summary>
public sealed record RoundFacts(Guid RoundId, RoundState State, DateTimeOffset StartsAt, DateOnly LocalDate, SummaryRules Summary)
{
    /// <summary>When someone tapped "Encerrar rodada" (ADR 0072, D1). Not in the projection's key: closing rebuilds nothing.</summary>
    public DateTimeOffset? ClosedAt { get; init; }

    /// <summary>When the round ended, or will end on its own: the MVP vote opens then (ADR 0072, D1).</summary>
    public DateTimeOffset EndsAt => Domain.Rounds.RoundEnd.Of(StartsAt, ClosedAt);
}
