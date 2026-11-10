using System.Collections.Immutable;

namespace Sacou.Modules.Groups.Domain.Settings;

/// <summary>
/// A document or a layer back to a tree, blocks and leaves in catalog order, with <c>schemaVersion</c>
/// first and no empty block: the shape the JSON writer stores and the app reads.
/// </summary>
internal static class SettingsTree
{
    public static ObjectNode ToNode(SettingsCatalog catalog, GroupSettings settings) => ToNode(catalog, settings.Values);

    public static ObjectNode ToNode(SettingsCatalog catalog, SettingsLayer layer) => ToNode(catalog, layer.Values);

    private static ObjectNode ToNode(SettingsCatalog catalog, ImmutableDictionary<string, SettingsValue> values)
    {
        var blocks = catalog.Blocks
            .Select(block => KeyValuePair.Create(block, (SettingsNode)BlockNode(catalog, block, values)))
            .Where(block => !((ObjectNode)block.Value).Members.IsEmpty);
        KeyValuePair<string, SettingsNode>[] version =
            [KeyValuePair.Create(SettingsErrors.SchemaVersionKey, (SettingsNode)new NumberNode(SettingsCatalog.SchemaVersion))];
        return new ObjectNode([.. version, .. blocks]);
    }

    private static ObjectNode BlockNode(SettingsCatalog catalog, string block, ImmutableDictionary<string, SettingsValue> values) =>
        new([.. catalog.FieldsOf(block)
            .Where(field => values.ContainsKey(field.Path))
            .Select(field => KeyValuePair.Create(field.Leaf, values[field.Path].ToNode()))]);
}
