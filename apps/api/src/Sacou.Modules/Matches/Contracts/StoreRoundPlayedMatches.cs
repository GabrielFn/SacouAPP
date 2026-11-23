using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Contracts;

namespace Sacou.Modules.Matches.Contracts;

/// <summary>The Sessions' question (ADR 0076), answered with the court's own summary of the round.</summary>
internal sealed class StoreRoundPlayedMatches(ICourtSessionResults courts) : IRoundPlayedMatches
{
    public async Task<bool> HasFinishedMatchAsync(Guid groupId, Guid roundId, SummaryRules rules, CancellationToken cancellationToken)
    {
        var stream = await courts.FindOfRoundAsync(groupId, roundId, cancellationToken).ConfigureAwait(false);
        if (stream is null)
        {
            return false;
        }

        var results = await courts.SummarizeAsync(stream, rules, cancellationToken).ConfigureAwait(false);
        return results.Summary.FinishedMatches.Count > 0;
    }
}
