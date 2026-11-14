using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Groups.Domain.Groups;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>
/// The lock of every member and level write (ADR 0040, D8): <c>SELECT ... FOR UPDATE</c> on the group row, in the
/// caller's explicit transaction (EF opens none for raw SQL, and without one the lock would hold nothing).
/// </summary>
internal static class GroupRowLock
{
    /// <summary>False when the group does not exist; then nothing is locked.</summary>
    public static async Task<bool> TryLockAsync(GroupsDbContext database, GroupId group, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(database);
        var locked = await database.Database
            .SqlQuery<Guid>($"SELECT id AS \"Value\" FROM groups.groups WHERE id = {group.Value} FOR UPDATE")
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return locked.Count > 0;
    }
}
