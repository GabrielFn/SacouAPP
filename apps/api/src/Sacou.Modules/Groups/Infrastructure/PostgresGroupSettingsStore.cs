using Sacou.Shared.Members;
using System.Collections.Immutable;
using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.Domain.Settings;
using Sacou.Modules.Groups.Domain.Templates;
using Sacou.Modules.Groups.Infrastructure.Settings;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>Reads with <c>AsNoTracking</c> and never lock; the one write path locks the settings row (ADR 0041, D5).</summary>
internal sealed class PostgresGroupSettingsStore(GroupsDbContext database, TimeProvider time) : IGroupSettingsStore
{
    public async Task<StoredSettings?> FindAsync(GroupId group, CancellationToken cancellationToken)
    {
        var row = await database.GroupSettings.AsNoTracking()
            .SingleOrDefaultAsync(settings => settings.GroupId == group.Value, cancellationToken).ConfigureAwait(false);
        if (row is not null)
        {
            return SettingsRowMapping.ToStored(row);
        }

        var createdAt = await database.Groups.AsNoTracking()
            .Where(found => found.Id == group.Value).Select(found => (DateTimeOffset?)found.CreatedAt)
            .SingleOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        return createdAt is { } at ? SettingsRowMapping.Default(at) : null;
    }

    public async Task<IReadOnlyList<TemplateSummary>> ListTemplatesAsync(GroupId group, CancellationToken cancellationToken)
    {
        var rows = await database.SavedTemplates.AsNoTracking()
            .Where(template => template.GroupId == group.Value)
            .OrderBy(template => template.CreatedAt).ThenBy(template => template.Id)
            .Select(template => new { template.Id, template.Name, template.CreatedAt })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return [.. rows.Select(row => new TemplateSummary(new TemplateId(row.Id), TemplateName.FromStored(row.Name), row.CreatedAt))];
    }

    public async Task<Result<SettingsChange>> ExecuteInSettingsLockAsync(
        GroupId group, MemberId actor, Func<SettingsState, Result<SettingsChange>> change, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(change);
        // EF opens no transaction for raw SQL by itself: without this one, FOR UPDATE would lock nothing.
        var transaction = await database.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            var state = await LockAndLoadAsync(group, actor, cancellationToken).ConfigureAwait(false);
            if (state.IsFailure)
            {
                return Result.Failure<SettingsChange>(state.Error);
            }

            var changed = change(state.Value);
            if (changed.IsFailure)
            {
                return changed;
            }

            await WriteAsync(group, actor, changed.Value, cancellationToken).ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            return changed;
        }
    }

    private async Task<Result<SettingsState>> LockAndLoadAsync(GroupId group, MemberId actor, CancellationToken cancellationToken)
    {
        await EnsureRowAsync(group, actor, cancellationToken).ConfigureAwait(false);
        var locked = await database.Database
            .SqlQuery<Guid>($"SELECT group_id AS \"Value\" FROM groups.group_settings WHERE group_id = {group.Value} FOR UPDATE")
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        if (locked.Count == 0 || !await MayManageAsync(group, actor, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<SettingsState>(GroupErrors.Forbidden);
        }

        var row = await database.GroupSettings.AsNoTracking().SingleAsync(settings => settings.GroupId == group.Value, cancellationToken).ConfigureAwait(false);
        var templates = await database.SavedTemplates.AsNoTracking()
            .Where(template => template.GroupId == group.Value)
            .OrderBy(template => template.CreatedAt).ThenBy(template => template.Id)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(new SettingsState(
            SettingsRowMapping.ToStored(row), [.. templates.Select(SettingsRowMapping.ToTemplate)]));
    }

    /// <summary>
    /// A group made before the settings existed has no row: it is created as "Do zero" so there is a row to
    /// lock, but only for someone who may manage settings, and a row that exists is left as it is.
    /// </summary>
    private async Task EnsureRowAsync(GroupId group, MemberId actor, CancellationToken cancellationToken)
    {
        var active = ColumnValues.ActiveStatus;
        var roles = ColumnValues.RolesWith(GroupPermission.ManageSettings).ToArray();
        var fallback = SettingsRowMapping.ToRow(group, SettingsRowMapping.Default(time.GetUtcNow()), actor);
        _ = await database.Database.ExecuteSqlAsync(
            $"""
            INSERT INTO groups.group_settings (group_id, schema_version, settings, template_key, saved_template_id, updated_at, updated_by_member_id)
            SELECT {fallback.GroupId}, {fallback.SchemaVersion}, {fallback.Settings}::jsonb, NULL, NULL, {fallback.UpdatedAt}, {fallback.UpdatedByMemberId}
            WHERE EXISTS (SELECT 1 FROM groups.members
                          WHERE id = {actor.Value} AND group_id = {group.Value} AND status = {active} AND role = ANY({roles}))
            ON CONFLICT (group_id) DO NOTHING
            """,
            cancellationToken).ConfigureAwait(false);
    }

    private Task<bool> MayManageAsync(GroupId group, MemberId actor, CancellationToken cancellationToken)
    {
        var active = ColumnValues.ActiveStatus;
        var roles = ColumnValues.RolesWith(GroupPermission.ManageSettings);
        return database.Members.AsNoTracking().AnyAsync(
            member => member.Id == actor.Value && member.GroupId == group.Value && member.Status == active && roles.Contains(member.Role),
            cancellationToken);
    }

    private async Task WriteAsync(GroupId group, MemberId actor, SettingsChange change, CancellationToken cancellationToken)
    {
        _ = database.GroupSettings.Update(SettingsRowMapping.ToRow(group, change.Settings, actor));
        if (change.Added is { } added)
        {
            _ = database.SavedTemplates.Add(SettingsRowMapping.ToRow(group, added, actor));
        }

        if (change.Removed is { } removed)
        {
            var row = await database.SavedTemplates.AsNoTracking()
                .SingleAsync(template => template.GroupId == group.Value && template.Id == removed.Value, cancellationToken).ConfigureAwait(false);
            _ = database.SavedTemplates.Remove(row);
        }

        _ = await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
