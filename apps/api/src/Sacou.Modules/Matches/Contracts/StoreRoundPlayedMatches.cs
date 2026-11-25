using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Matches.AppendCourtEvents;
using Sacou.Modules.Sessions.Contracts;
using Sacou.Shared.Results;

namespace Sacou.Modules.Matches.Contracts;

/// <summary>The Sessions' question (ADR 0076), answered with the court's own summary of the round, from its snapshot (ADR 0081).</summary>
internal sealed class StoreRoundPlayedMatches(ICourtSessionResults courts) : IRoundPlayedMatches
{
    public async Task<Result<bool>> HasFinishedMatchAsync(Guid groupId, Guid roundId, SummaryRules rules, CancellationToken cancellationToken)
    {
        var stream = await courts.FindOfRoundAsync(groupId, roundId, cancellationToken).ConfigureAwait(false);
        if (stream is null)
        {
            return Result.Success(false);
        }

        var results = await courts.SummarizeAsync(stream, rules, cancellationToken).ConfigureAwait(false);
        return results is null
            ? Result.Failure<bool>(CourtErrors.CourtBusy)
            : Result.Success(results.Summary.FinishedMatches.Count > 0);
    }
}
