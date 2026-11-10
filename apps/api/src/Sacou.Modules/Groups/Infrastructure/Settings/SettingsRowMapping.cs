using Sacou.Shared.Members;
using System.Text.Json;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Settings;
using Sacou.Modules.Groups.Domain.Templates;

namespace Sacou.Modules.Groups.Infrastructure.Settings;

/// <summary>
/// Settings rows to the domain and back, by hand. The jsonb always goes through the domain parser, never
/// straight into a type (ADR 0041): a row that does not parse is a server fault, reported with the group id only.
/// </summary>
internal static class SettingsRowMapping
{
    private static SettingsCatalog Catalog => SettingsCatalogReader.Catalog;

    public static GroupSettingsRow ToRow(GroupId group, StoredSettings stored, MemberId updatedBy) => new()
    {
        GroupId = group.Value,
        SchemaVersion = SettingsCatalog.SchemaVersion,
        Settings = SettingsJsonWriter.Write(SettingsTree.ToNode(Catalog, stored.Settings)),
        TemplateKey = stored.TemplateKey,
        SavedTemplateId = stored.SavedTemplateId?.Value,
        UpdatedAt = stored.UpdatedAt,
        UpdatedByMemberId = updatedBy.Value,
    };

    public static StoredSettings ToStored(GroupSettingsRow row) => new(
        Parse(row.GroupId, SettingsParser.ParseGroupSettings(Catalog, Read(row.GroupId, row.Settings))),
        row.TemplateKey,
        row.SavedTemplateId is { } saved ? new TemplateId(saved) : null,
        row.UpdatedAt);

    public static SavedTemplateRow ToRow(GroupId group, SavedTemplate template, MemberId createdBy) => new()
    {
        Id = template.Id.Value,
        GroupId = group.Value,
        Name = template.Name.Value,
        SchemaVersion = SettingsCatalog.SchemaVersion,
        Settings = SettingsJsonWriter.Write(SettingsTree.ToNode(Catalog, template.Snapshot)),
        CreatedAt = template.CreatedAt,
        CreatedByMemberId = createdBy.Value,
    };

    public static SavedTemplate ToTemplate(SavedTemplateRow row) => new(
        new TemplateId(row.Id),
        TemplateName.FromStored(row.Name),
        Parse(row.GroupId, SettingsParser.ParseSnapshot(Catalog, Read(row.GroupId, row.Settings))),
        row.CreatedAt);

    /// <summary>The ready-made "Do zero" document: a group without a row (made before the settings existed) reads as this.</summary>
    public static StoredSettings Default(DateTimeOffset updatedAt) =>
        new(SettingsResolver.Defaults(Catalog), TemplateKey: null, SavedTemplateId: null, updatedAt);

    private static SettingsNode Read(Guid group, string json)
    {
        try
        {
            return SettingsJsonReader.Parse(json);
        }
        catch (JsonException)
        {
            throw Corrupt(group);
        }
    }

    private static T Parse<T>(Guid group, SettingsResult<T> parsed)
        where T : class =>
        parsed.IsSuccess ? parsed.Value : throw Corrupt(group);

    /// <summary>The message carries the group id and nothing of the content: it may hold a venue or a template name.</summary>
    private static InvalidOperationException Corrupt(Guid group) =>
        new($"Stored settings of group {group} do not parse.");
}
