namespace Sacou.Modules.Matches.Contracts;

/// <summary>
/// Called after the commit of a write that stored a <c>MatchEnded</c> or a <c>RevertedTo</c> (E3.9, ADR 0071). Only
/// ids, never an event. Best effort: a failure is logged by stream id and the write still answers as it did. The Stats
/// does not listen (E3.9 part 4b): its projections are rebuilt on the read, which the key of freshness makes exact, so
/// the write that closes a match never pays a replay. The seam stays for a cheap listener (E3.18, E5.3b).
/// </summary>
public interface ICourtStreamChanged
{
    Task CourtStreamChangedAsync(Guid groupId, Guid roundId, Guid courtSessionId, CancellationToken cancellationToken);
}
