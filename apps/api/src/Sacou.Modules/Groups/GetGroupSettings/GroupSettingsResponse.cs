using System.Text.Json.Nodes;
using Sacou.Modules.Groups.Domain.Settings;
using Sacou.Modules.Groups.Infrastructure.Settings;

namespace Sacou.Modules.Groups.GetGroupSettings;

/// <summary>
/// The settings of a group, as every settings route answers: the complete document (with its own
/// <c>schemaVersion</c>, so it can be sent back as it is), the template last applied for the label "Modelo
/// usado" (at most one of the two ids) and when it last changed. No member id: who changed it stays inside.
/// </summary>
internal sealed record GroupSettingsResponse(
    int SchemaVersion, JsonNode? Settings, string? TemplateKey, Guid? SavedTemplateId, DateTimeOffset UpdatedAt)
{
    public static GroupSettingsResponse From(StoredSettings stored)
    {
        ArgumentNullException.ThrowIfNull(stored);
        var catalog = SettingsCatalogReader.Catalog;
        var document = JsonNode.Parse(SettingsJsonWriter.Write(SettingsTree.ToNode(catalog, stored.Settings)));
        return new GroupSettingsResponse(
            SettingsCatalog.SchemaVersion, document, stored.TemplateKey, stored.SavedTemplateId?.Value, stored.UpdatedAt);
    }
}
