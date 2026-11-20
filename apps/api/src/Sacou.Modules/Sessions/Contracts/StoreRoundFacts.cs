using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Infrastructure;
using Sacou.Shared.Persistence;

namespace Sacou.Modules.Sessions.Contracts;

/// <summary>One indexed read of the rounds, no lock and no attendances; the settings of the group are read once.</summary>
internal sealed class StoreRoundFacts(SessionsDbContext database, IGroupSettingsReader settings) : IRoundFacts
{
    public async Task<RoundFacts?> FindAsync(Guid groupId, Guid roundId, CancellationToken cancellationToken)
    {
        var found = await ReadAsync(groupId, database.Rounds.AsNoTracking().Where(round => round.GroupId == groupId && round.Id == roundId), cancellationToken)
            .ConfigureAwait(false);
        return found.SingleOrDefault();
    }

    public Task<IReadOnlyList<RoundFacts>> ListAsync(Guid groupId, CancellationToken cancellationToken) =>
        ReadAsync(groupId, database.Rounds.AsNoTracking().Where(round => round.GroupId == groupId), cancellationToken);

    private async Task<IReadOnlyList<RoundFacts>> ReadAsync(Guid groupId, IQueryable<RoundRow> rounds, CancellationToken cancellationToken)
    {
        var rows = await rounds
            .OrderBy(round => round.StartsAt).ThenBy(round => round.Id)
            .Select(round => new { round.Id, round.Status, round.StartsAt, round.LocalDate, round.SettingsLayer })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        if (rows.Count == 0)
        {
            return [];
        }

        var snapshot = await settings.GetAsync(groupId, cancellationToken).ConfigureAwait(false);
        if (snapshot is null)
        {
            return [];
        }

        return [.. rows.Select(row => new RoundFacts(
            row.Id,
            StoreRoundDirectory.ToContract(EnumColumns.Parse(ColumnValues.RoundStatuses, row.Status)),
            row.StartsAt,
            row.LocalDate,
            Resolve(settings, snapshot, row.SettingsLayer)))];
    }

    private static SummaryRules Resolve(IGroupSettingsReader settings, GroupSettingsSnapshot snapshot, string? layer)
    {
        var resolved = settings.ResolveRound(snapshot, layer);
        return resolved.IsSuccess ? resolved.Value.Summary : throw new InvalidOperationException("A stored round layer is invalid.");
    }
}
