using Sacou.Shared.Members;
using System.Collections.Immutable;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Settings;
using Sacou.Modules.Groups.Domain.Templates;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>What a settings write sees under the lock: the group's settings and its saved templates.</summary>
internal sealed record SettingsState(StoredSettings Current, ImmutableArray<SavedTemplate> Templates);

/// <summary>What a settings write changes: the settings to store, a template to add and a template to remove, if any.</summary>
internal sealed record SettingsChange(StoredSettings Settings)
{
    public SavedTemplate? Added { get; init; }

    public TemplateId? Removed { get; init; }
}

/// <summary>What the template list shows. The snapshot stays in the database.</summary>
internal sealed record TemplateSummary(TemplateId Id, TemplateName Name, DateTimeOffset CreatedAt);

/// <summary>
/// Where the settings and saved templates of a group live (ADR 0041, D5). Every read goes by the group id of
/// the route, and a template by <c>(group_id, id)</c>: never a bare id (ADR 0040, D7).
/// </summary>
internal interface IGroupSettingsStore
{
    /// <summary>The group's settings; a group without a row (created before the settings existed) reads as "Do zero". Null when the group does not exist.</summary>
    Task<StoredSettings?> FindAsync(GroupId group, CancellationToken cancellationToken);

    /// <summary>The group's saved templates, oldest first.</summary>
    Task<IReadOnlyList<TemplateSummary>> ListTemplatesAsync(GroupId group, CancellationToken cancellationToken);

    /// <summary>
    /// Every write of settings or templates: one transaction that locks the group's settings row
    /// (<c>SELECT ... FOR UPDATE</c>, created first if the group has none), checks under the lock that
    /// <paramref name="actor"/> is still an active member whose role may manage settings (a demotion that lands
    /// after the access filter wins: <c>groups.forbidden</c>), loads the settings and the templates, applies
    /// <paramref name="change"/> and writes what it returns. Writes of one group run one after another, so a
    /// partial patch is merged on the latest state and the template ceiling cannot be passed by a race.
    /// A failed change writes nothing.
    /// </summary>
    Task<Result<SettingsChange>> ExecuteInSettingsLockAsync(
        GroupId group, MemberId actor, Func<SettingsState, Result<SettingsChange>> change, CancellationToken cancellationToken);
}
