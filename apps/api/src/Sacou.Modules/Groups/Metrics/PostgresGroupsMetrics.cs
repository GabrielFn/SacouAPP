using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Shared.Metrics;

namespace Sacou.Modules.Groups.Metrics;

/// <summary>One read of <c>groups.groups</c>, three columns, no tracking (ADR 0085, D2).</summary>
internal sealed class PostgresGroupsMetrics(GroupsDbContext database) : IGroupsMetrics
{
    public async Task<IReadOnlyList<CountedGroup>> ListAsync(CancellationToken cancellationToken)
    {
        database.Database.SetCommandTimeout(MetricsQueries.CommandTimeout);
        var rows = await database.Groups.AsNoTracking()
            .OrderBy(group => group.CreatedAt).ThenBy(group => group.Id)
            .Select(group => new { group.Id, group.Name, group.CreatedAt })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return [.. rows.Select(row => new CountedGroup(row.Id, row.Name, row.CreatedAt))];
    }
}
