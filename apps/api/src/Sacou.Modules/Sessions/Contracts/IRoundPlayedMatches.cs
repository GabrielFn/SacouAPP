using Sacou.Modules.Groups.Contracts;

namespace Sacou.Modules.Sessions.Contracts;

/// <summary>
/// Whether the court of a round already finished a match (ADR 0076). The Sessions cannot read the Matches (the Matches
/// reference the Sessions), so this port lives here and the Matches implement it on <c>ICourtSessionResults</c>.
/// </summary>
public interface IRoundPlayedMatches
{
    /// <summary>True when the stored stream of the round, summarized with <paramref name="rules"/>, has at least one finished match.</summary>
    Task<bool> HasFinishedMatchAsync(Guid groupId, Guid roundId, SummaryRules rules, CancellationToken cancellationToken);
}
