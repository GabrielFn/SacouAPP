namespace Sacou.Modules.Matches.Contracts;

/// <summary>
/// Called after the commit of a write that stored a <c>MatchEnded</c> or a <c>RevertedTo</c> (E3.9, ADR 0071), so the
/// projections rebuild at once. Only ids, never an event. Best effort: a failure is logged by stream id and the write
/// still answers as it did; the next read rebuilds.
/// </summary>
public interface ICourtStreamChanged
{
    Task CourtStreamChangedAsync(Guid groupId, Guid roundId, Guid courtSessionId, CancellationToken cancellationToken);
}
