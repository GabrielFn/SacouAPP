using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.Domain.Settings;
using Sacou.Modules.Groups.Infrastructure.Settings;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>
/// Reads with <c>AsNoTracking</c> and never lock (light CQRS). SQL is always parameterized: EF turns the
/// interpolated values into parameters (ADR 0037, ADR 0040).
/// </summary>
internal sealed partial class PostgresGroupStore(GroupsDbContext database) : IGroupStore
{
    /// <summary>First key of the two-key advisory lock: "memberships of one person", so it never collides with another lock family.</summary>
    private const int MembershipLockFamily = 3_202;

    public async Task<Result> CreateAsync(Group group, UserId creator, Func<int, Result> admission, StoredSettings settings, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(group);
        ArgumentNullException.ThrowIfNull(admission);
        ArgumentNullException.ThrowIfNull(settings);
        var transaction = await database.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            await LockPersonAsync(creator, cancellationToken).ConfigureAwait(false);
            var admitted = admission(await CountActiveGroupsAsync(creator, cancellationToken).ConfigureAwait(false));
            if (admitted.IsFailure)
            {
                return admitted;
            }

            database.Groups.Add(RowMapping.ToRow(group));
            database.Members.AddRange(group.Members.Select(member => RowMapping.ToRow(group.Id, member)));
            database.GroupSettings.Add(SettingsRowMapping.ToRow(group.Id, settings, group.Members[0].Id));
            await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            return admitted;
        }
    }

    public async Task<IReadOnlyList<MemberGroup>> ListActiveGroupsAsync(UserId user, CancellationToken cancellationToken)
    {
        var rows = await ActiveMembers()
            .Where(member => member.UserId == user.Value)
            .Join(database.Groups.AsNoTracking(), member => member.GroupId, group => group.Id, (member, group) => new { member, group.Name })
            .OrderBy(pair => pair.member.JoinedAt).ThenBy(pair => pair.member.Id)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return [.. rows.Select(pair => new MemberGroup(
            new GroupId(pair.member.GroupId), RowMapping.ToName(pair.Name), RowMapping.ToMember(pair.member)))];
    }

    public async Task<GroupMember?> FindActiveMemberAsync(GroupId group, UserId user, CancellationToken cancellationToken)
    {
        var row = await ActiveMembers()
            .SingleOrDefaultAsync(member => member.GroupId == group.Value && member.UserId == user.Value, cancellationToken)
            .ConfigureAwait(false);
        return row is null ? null : RowMapping.ToMember(row);
    }

    public async Task<GroupOverview?> FindOverviewAsync(GroupId group, CancellationToken cancellationToken)
    {
        var active = ColumnValues.ActiveStatus;
        var overview = await database.Groups.AsNoTracking()
            .Where(row => row.Id == group.Value)
            .Select(row => new
            {
                row.Name,
                Active = database.Members.Count(member => member.GroupId == row.Id && member.Status == active),
            })
            .SingleOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        return overview is null ? null : new GroupOverview(group, RowMapping.ToName(overview.Name), overview.Active);
    }

    public async Task<IReadOnlyList<GroupMember>> ListActiveMembersAsync(GroupId group, CancellationToken cancellationToken)
    {
        var rows = await ActiveMembers()
            .Where(member => member.GroupId == group.Value)
            .OrderBy(member => member.JoinedAt).ThenBy(member => member.Id)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return [.. rows.Select(RowMapping.ToMember)];
    }

    public async Task<bool> RenameAsync(GroupId group, UserId renamer, GroupName name, CancellationToken cancellationToken)
    {
        var active = ColumnValues.ActiveStatus;
        var roles = ColumnValues.RolesWith(GroupPermission.RenameGroup);
        var renamed = await database.Groups
            .Where(row => row.Id == group.Value && database.Members.Any(member =>
                member.GroupId == row.Id && member.UserId == renamer.Value && member.Status == active && roles.Contains(member.Role)))
            .ExecuteUpdateAsync(setters => setters.SetProperty(row => row.Name, name.Value), cancellationToken)
            .ConfigureAwait(false);
        return renamed > 0;
    }

    public async Task<Result<GroupChange>> ExecuteInGroupLockAsync(
        GroupId group, Func<Group, Result<GroupChange>> change, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(change);
        // EF opens no transaction for raw SQL by itself: without this one, FOR UPDATE would lock nothing.
        var transaction = await database.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            var changed = await ChangeUnderLockAsync(group, locked => Task.FromResult(change(locked)), cancellationToken).ConfigureAwait(false);
            if (changed.IsSuccess)
            {
                await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            }

            return changed;
        }
    }

    /// <summary>Inside the caller's transaction: lock, load, change, and write the rows the change returned, new or changed.</summary>
    private async Task<Result<GroupChange>> ChangeUnderLockAsync(
        GroupId group, Func<Group, Task<Result<GroupChange>>> change, CancellationToken cancellationToken)
    {
        var loaded = await LockAndLoadAsync(group, cancellationToken).ConfigureAwait(false);
        if (loaded is null)
        {
            return Result.Failure<GroupChange>(GroupErrors.GroupNotFound);
        }

        var changed = await change(loaded).ConfigureAwait(false);
        if (changed.IsFailure || changed.Value.IsEmpty)
        {
            return changed;
        }

        Write(loaded, changed.Value);
        await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return changed;
    }

    /// <summary>Each row is written whole, as read under the lock: nothing outside the lock may write a member or an invite.</summary>
    private void Write(Group before, GroupChange change)
    {
        foreach (var member in change.ChangedMembers)
        {
            var row = RowMapping.ToRow(before.Id, member);
            _ = before.Members.Any(known => known.Id == member.Id) ? database.Members.Update(row) : database.Members.Add(row);
        }

        foreach (var invite in change.ChangedInvites)
        {
            var row = RowMapping.ToRow(before.Id, invite);
            _ = before.Invites.Any(known => known.Id == invite.Id) ? database.Invites.Update(row) : database.Invites.Add(row);
        }
    }

    /// <summary>The group row is locked first, always: the lock order of ADR 0040, D7 (group before person).</summary>
    private async Task<Group?> LockAndLoadAsync(GroupId group, CancellationToken cancellationToken)
    {
        var locked = await database.Database
            .SqlQuery<Guid>($"SELECT id AS \"Value\" FROM groups.groups WHERE id = {group.Value} FOR UPDATE")
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        if (locked.Count == 0)
        {
            return null;
        }

        var row = await database.Groups.AsNoTracking().SingleAsync(row => row.Id == group.Value, cancellationToken).ConfigureAwait(false);
        var members = await database.Members.AsNoTracking()
            .Where(member => member.GroupId == group.Value)
            .OrderBy(member => member.JoinedAt).ThenBy(member => member.Id)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var invites = await database.Invites.AsNoTracking()
            .Where(invite => invite.GroupId == group.Value)
            .OrderBy(invite => invite.CreatedAt).ThenBy(invite => invite.Id)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return new Group(group, RowMapping.ToName(row.Name), row.CreatedAt, [.. members.Select(RowMapping.ToMember)])
        {
            Invites = [.. invites.Select(RowMapping.ToInvite)],
        };
    }

    /// <summary>The per-person advisory lock, in the caller's transaction. Always after the group lock when both are taken.</summary>
    private Task<int> LockPersonAsync(UserId person, CancellationToken cancellationToken) =>
        database.Database.ExecuteSqlAsync(
            $"SELECT pg_advisory_xact_lock({MembershipLockFamily}, hashtext({person.Value.ToString()}))", cancellationToken);

    private Task<int> CountActiveGroupsAsync(UserId user, CancellationToken cancellationToken) =>
        ActiveMembers().CountAsync(member => member.UserId == user.Value, cancellationToken);

    private IQueryable<MemberRow> ActiveMembers()
    {
        var active = ColumnValues.ActiveStatus;
        return database.Members.AsNoTracking().Where(member => member.Status == active);
    }
}
