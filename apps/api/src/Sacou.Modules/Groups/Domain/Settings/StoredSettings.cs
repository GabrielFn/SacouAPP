using Sacou.Modules.Groups.Domain.Templates;

namespace Sacou.Modules.Groups.Domain.Settings;

/// <summary>
/// The settings of a group as stored: the complete document and the template last applied, for the label
/// "Modelo usado" only (at most one of the two is set; editing a field afterwards keeps the label).
/// </summary>
internal sealed record StoredSettings(GroupSettings Settings, string? TemplateKey, TemplateId? SavedTemplateId, DateTimeOffset UpdatedAt);
