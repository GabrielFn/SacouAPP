using Microsoft.Extensions.Logging;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.GetDeletionBlockers;

/// <summary>Asks every module that can block (Groups, in the pilot) and joins the answers.</summary>
internal sealed partial class GetDeletionBlockersHandler(
    ICurrentUser currentUser, IEnumerable<IAccountDeletionBlockers> sources, ILogger<GetDeletionBlockersHandler> logger)
{
    public async Task<Result<DeletionBlockersResponse>> HandleAsync(CancellationToken cancellationToken)
    {
        var user = await currentUser.GetAsync(cancellationToken).ConfigureAwait(false);
        if (user.IsFailure)
        {
            return Result.Failure<DeletionBlockersResponse>(user.Error);
        }

        var blockers = new List<DeletionBlocker>();
        foreach (var source in sources)
        {
            blockers.AddRange(await source.FindAsync(user.Value.UserId, cancellationToken).ConfigureAwait(false));
        }

        Listed(logger, blockers.Count);
        return Result.Success(DeletionBlockersResponse.From(blockers));
    }

    /// <summary>Only how many groups block, never which (ADR 0056, D11).</summary>
    [LoggerMessage(Level = LogLevel.Information, Message = "Deletion blockers listed: {Groups} groups.")]
    private static partial void Listed(ILogger logger, int groups);
}
