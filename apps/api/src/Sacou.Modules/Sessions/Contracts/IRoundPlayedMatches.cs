using Sacou.Modules.Groups.Contracts;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Contracts;

/// <summary>
/// Whether the court of a round already finished a match (ADR 0076). The Sessions cannot read the Matches (the Matches
/// reference the Sessions), so this port lives here and the Matches implement it on <c>ICourtSessionResults</c>.
/// </summary>
public interface IRoundPlayedMatches
{
    /// <summary>
    /// True when the stored stream of the round, summarized with <paramref name="rules"/>, has at least one finished
    /// match. A failure (503 <c>matches.court-busy</c>) when the court cannot be summarized now (ADR 0081, Part 2).
    /// </summary>
    Task<Result<bool>> HasFinishedMatchAsync(Guid groupId, Guid roundId, SummaryRules rules, CancellationToken cancellationToken);
}
