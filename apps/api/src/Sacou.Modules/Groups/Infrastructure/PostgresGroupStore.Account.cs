using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Members;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>The reads of the person's own account data (E3.16): by <c>user_id</c>, without a lock.</summary>
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
}
