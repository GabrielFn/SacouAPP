using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Infrastructure;
using Sacou.Shared.Persistence;

namespace Sacou.Modules.Sessions.Contracts;

/// <summary>One indexed read of the round's status, no lock and no attendances.</summary>
internal sealed class StoreRoundDirectory(SessionsDbContext database) : IRoundDirectory
{
    public async Task<RoundSummary?> FindAsync(Guid groupId, Guid roundId, CancellationToken cancellationToken)
    {
        var status = await database.Rounds.AsNoTracking()
            .Where(round => round.GroupId == groupId && round.Id == roundId)
            .Select(round => round.Status)
            .SingleOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        return status is null ? null : new RoundSummary(ToContract(EnumColumns.Parse(ColumnValues.RoundStatuses, status)));
    }

    private static RoundState ToContract(RoundStatus status) => status switch
    {
        RoundStatus.Scheduled => RoundState.Scheduled,
        RoundStatus.Canceled => RoundState.Canceled,
        _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Every round status has a contract value."),
    };
}
