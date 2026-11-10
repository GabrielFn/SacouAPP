using Sacou.Modules.Groups.Domain.Settings;

namespace Sacou.Modules.Groups.Domain.Templates;

/// <summary>A snapshot of the leaves of a group that are not facts, with a name. Copied on apply, never linked.</summary>
internal sealed record SavedTemplate(TemplateId Id, TemplateName Name, SettingsLayer Snapshot, DateTimeOffset CreatedAt);
