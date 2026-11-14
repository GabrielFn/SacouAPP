using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Levels;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Shared.Levels;
using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>
/// Reads with <c>AsNoTracking</c> and never lock; the one write path holds the group lock (ADR 0051, D10). SQL is
/// always parameterized. A row off the scale (only possible if the CHECK were dropped) is skipped and logged without
/// any id or value: the member reads as never reviewed, never as a 500.
/// </summary>
internal sealed partial class PostgresMemberLevelStore(GroupsDbContext database, ILogger<PostgresMemberLevelStore> logger) : IMemberLevelStore
{
    public async Task<IReadOnlyList<MemberLevel>> ListAsync(GroupId group, CancellationToken cancellationToken)
    {
        var rows = await database.MemberLevels.AsNoTracking()
            .Where(level => level.GroupId == group.Value)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return ToDomain(rows);
    }

    public async Task<IReadOnlyList<MemberLevelInput>> FindInputsAsync(
        GroupId group, IReadOnlyCollection<MemberId> members, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(members);
        if (members.Count == 0)
        {
            return [];
        }

        Guid[] ids = [.. members.Select(member => member.Value).Distinct()];
        var rows = await database.Members.AsNoTracking()
            .Where(member => member.GroupId == group.Value && ids.Contains(member.Id))
            .OrderBy(member => member.JoinedAt).ThenBy(member => member.Id)
            .Select(member => new { member.Id, member.UserId })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var levels = await database.MemberLevels.AsNoTracking()
            .Where(level => level.GroupId == group.Value && ids.Contains(level.MemberId))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var byMember = ToDomain(levels).ToDictionary(level => level.MemberId);
        return [.. rows.Select(row => new MemberLevelInput(
            new MemberId(row.Id),
            row.UserId is { } user ? new UserId(user) : null,
            byMember.GetValueOrDefault(new MemberId(row.Id))))];
    }

    public async Task<Result<MemberLevelChange>> ExecuteInGroupLockAsync(
        GroupId group, Func<MemberLevelContext, Result<MemberLevelChange>> change, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(change);
        // EF opens no transaction for raw SQL by itself: without this one, FOR UPDATE would lock nothing.
        var transaction = await database.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            var context = await LockAndLoadAsync(group, cancellationToken).ConfigureAwait(false);
            if (context is null)
            {
                return Result.Failure<MemberLevelChange>(GroupErrors.GroupNotFound);
            }

            var changed = change(context);
            if (changed.IsFailure)
            {
                return changed;
            }

            foreach (var level in changed.Value.Levels)
            {
                await UpsertAsync(level, cancellationToken).ConfigureAwait(false);
            }

            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            return changed;
        }
    }

    /// <summary>The group row first, as every member write does; then only the members, without the invites.</summary>
    private async Task<MemberLevelContext?> LockAndLoadAsync(GroupId group, CancellationToken cancellationToken)
    {
        var locked = await database.Database
            .SqlQuery<Guid>($"SELECT id AS \"Value\" FROM groups.groups WHERE id = {group.Value} FOR UPDATE")
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        if (locked.Count == 0)
        {
            return null;
        }

        var members = await database.Members.AsNoTracking()
            .Where(member => member.GroupId == group.Value)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return new MemberLevelContext(group, [.. members.Select(RowMapping.ToMember)]);
    }

    /// <summary>
    /// The last write wins. The update keeps the row's group: a member id is of one group for ever, and the domain
    /// already refused a target from another group, so the guard only stops a bug from moving a row.
    /// </summary>
    private Task<int> UpsertAsync(MemberLevel level, CancellationToken cancellationToken)
    {
        short? tenths = level.Level is { } value ? checked((short)value.Tenths) : null;
        return database.Database.ExecuteSqlAsync(
            $"""
            INSERT INTO groups.member_levels (member_id, group_id, level_tenths, set_by_member_id, set_at)
            VALUES ({level.MemberId.Value}, {level.GroupId.Value}, {tenths}, {level.SetBy.Value}, {level.SetAt})
            ON CONFLICT (member_id) DO UPDATE SET
                level_tenths = EXCLUDED.level_tenths,
                set_by_member_id = EXCLUDED.set_by_member_id,
                set_at = EXCLUDED.set_at
            WHERE member_levels.group_id = EXCLUDED.group_id
            """,
            cancellationToken);
    }

    private List<MemberLevel> ToDomain(IEnumerable<MemberLevelRow> rows)
    {
        var levels = new List<MemberLevel>();
        foreach (var row in rows)
        {
            SkillLevel? level = null;
            if (row.LevelTenths is { } tenths)
            {
                var parsed = SkillLevel.FromTenths(tenths);
                if (parsed.IsFailure)
                {
                    LogCorruptedRow(logger);
                    continue;
                }

                level = parsed.Value;
            }

            levels.Add(new MemberLevel(new MemberId(row.MemberId), new GroupId(row.GroupId), level, new MemberId(row.SetByMemberId), row.SetAt));
        }

        return levels;
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "A member level row off the scale was skipped.")]
    private static partial void LogCorruptedRow(ILogger logger);
}
