using Microsoft.EntityFrameworkCore;
using Npgsql;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Infrastructure;

/// <summary>The round link (E3.12, ADR 0070, D1): the lookup by code, and the code a round made before the link gets on read.</summary>
internal sealed partial class PostgresRoundStore
{
    public async Task<Round?> FindByLinkCodeAsync(RoundLinkCode code, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(code);
        var row = await database.Rounds.AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.LinkCode == code.Value, cancellationToken)
            .ConfigureAwait(false);
        if (row is null)
        {
            return null;
        }

        var attendances = await AttendancesOfAsync([row.Id], cancellationToken).ConfigureAwait(false);
        return RowMapping.ToRound(row, attendances[row.Id]);
    }

    public async Task<Result<RoundLinkCode>> AssignLinkCodeAsync(
        GroupId group, RoundId round, RoundLinkCode candidate, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(candidate);
        try
        {
            // Only while it has none: two first reads together keep the code of the first, and a write under the
            // round's lock waits for this row like any other.
            _ = await database.Rounds
                .Where(row => row.Id == round.Value && row.GroupId == group.Value && row.LinkCode == null)
                .ExecuteUpdateAsync(setters => setters.SetProperty(row => row.LinkCode, candidate.Value), cancellationToken)
                .ConfigureAwait(false);
        }
        catch (PostgresException exception) when (IsLinkCodeTaken(exception))
        {
            return Result.Failure<RoundLinkCode>(RoundLinkCodeErrors.Taken);
        }

        var stored = await database.Rounds.AsNoTracking()
            .Where(row => row.Id == round.Value && row.GroupId == group.Value)
            .Select(row => row.LinkCode)
            .SingleOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        return stored is null
            ? Result.Failure<RoundLinkCode>(RoundErrors.RoundNotFound)
            : Result.Success(RoundLinkCode.FromStored(stored));
    }

    private static bool IsLinkCodeTaken(PostgresException exception) => exception is
    {
        SqlState: PostgresErrorCodes.UniqueViolation,
        ConstraintName: RoundConfiguration.LinkCodeIndex,
    };
}
