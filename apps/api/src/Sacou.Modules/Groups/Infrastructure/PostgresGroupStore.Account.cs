using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Members;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>
/// The person's own account data (E3.16): the reads by <c>user_id</c>, without a lock, and the erasure of the account,
/// under the locks of every group the person is in.
/// </summary>
internal sealed partial class PostgresGroupStore
{
    public async Task<IReadOnlyList<AccountMembership>> ListMembershipsOfUserAsync(UserId user, CancellationToken cancellationToken)
    {
        var rows = await WithGroupNamesAsync(
            database.Members.AsNoTracking().Where(member => member.UserId == user.Value), cancellationToken).ConfigureAwait(false);
        return [.. rows.Select(row => new AccountMembership(row.GroupId, row.Name, row.Member))];
    }

    /// <summary>The members with the name of their group, in the order they joined: the person's groups, active or all.</summary>
    private async Task<IReadOnlyList<(GroupId GroupId, GroupName Name, GroupMember Member)>> WithGroupNamesAsync(
        IQueryable<MemberRow> members, CancellationToken cancellationToken)
    {
        var rows = await members
            .Join(database.Groups.AsNoTracking(), member => member.GroupId, group => group.Id, (member, group) => new { member, group.Name })
            .OrderBy(pair => pair.member.JoinedAt).ThenBy(pair => pair.member.Id)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return [.. rows.Select(pair => (new GroupId(pair.member.GroupId), RowMapping.ToName(pair.Name), RowMapping.ToMember(pair.member)))];
    }

    public async Task<IReadOnlyList<Group>> ListGroupsWhereActiveAdminAsync(UserId user, CancellationToken cancellationToken)
    {
        var admin = ColumnValues.Roles[GroupRole.Admin];
        var groups = await ActiveMembers()
            .Where(member => member.UserId == user.Value && member.Role == admin)
            .Join(database.Groups.AsNoTracking(), member => member.GroupId, group => group.Id, (member, group) => group)
            .OrderBy(group => group.Id)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        if (groups.Count == 0)
        {
            return [];
        }

        Guid[] ids = [.. groups.Select(group => group.Id)];
        var members = await database.Members.AsNoTracking()
            .Where(member => ids.Contains(member.GroupId))
            .OrderBy(member => member.JoinedAt).ThenBy(member => member.Id)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var byGroup = members.ToLookup(member => member.GroupId);
        return [.. groups.Select(group => new Group(
            new GroupId(group.Id), RowMapping.ToName(group.Name), group.CreatedAt, [.. byGroup[group.Id].Select(RowMapping.ToMember)]))];
    }

    public async Task<IReadOnlyList<GroupId>> EraseAccountAsync(
        UserId user, Func<Group, bool> isBlocker, Func<Group, GroupChange> erase, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(isBlocker);
        ArgumentNullException.ThrowIfNull(erase);
        var transaction = await database.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            var groups = await LockGroupsOfAsync(user, cancellationToken).ConfigureAwait(false);
            await LockPersonAsync(user, cancellationToken).ConfigureAwait(false);
            List<GroupId> blocking = [.. groups.Where(isBlocker).Select(group => group.Id)];
            if (blocking.Count > 0)
            {
                return blocking;
            }

            foreach (var group in groups)
            {
                var change = erase(group);
                if (!change.IsEmpty)
                {
                    Write(group, change);
                }
            }

            Guid[] members = [.. groups.SelectMany(group => group.Members).Where(member => member.UserId == user).Select(member => member.Id.Value)];
            await database.MemberLevels.Where(level => members.Contains(level.MemberId)).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
            await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            return [];
        }
    }

    /// <summary>
    /// Ascending id order, so two erasures, or an erasure and a write of one group, never wait on each other in a
    /// cycle. A group the person joins after the first read is left for the sweep (ADR 0056, D7): locking it after the
    /// person's lock could close a cycle with an acceptance, which takes the group first.
    /// </summary>
    private async Task<IReadOnlyList<Group>> LockGroupsOfAsync(UserId user, CancellationToken cancellationToken)
    {
        var ids = await database.Members.AsNoTracking()
            .Where(member => member.UserId == user.Value)
            .Select(member => member.GroupId).Distinct().OrderBy(id => id)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var groups = new List<Group>(ids.Count);
        foreach (var id in ids)
        {
            if (await LockAndLoadAsync(new GroupId(id), cancellationToken).ConfigureAwait(false) is { } group)
            {
                groups.Add(group);
            }
        }

        return groups;
    }
}
