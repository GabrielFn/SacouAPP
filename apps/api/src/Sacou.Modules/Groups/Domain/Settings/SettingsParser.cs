namespace Sacou.Modules.Groups.Domain.Settings;

/// <summary>The two parsers of parse-settings.ts and parse-layer.ts. Reading from storage goes through here too, never straight into the type.</summary>
internal static class SettingsParser
{
    /// <summary>
    /// The complete document of a group, read strictly: a missing or extra leaf, a wrong type, a value out
    /// of its range or list, or another <c>schemaVersion</c> is refused. Null is not "inherit" here.
    /// </summary>
    public static SettingsResult<GroupSettings> ParseGroupSettings(SettingsCatalog catalog, SettingsNode node)
    {
        var read = SettingsTreeReader.Read(catalog, node, requiresBlocks: true, ReadDocumentLeaf);
        return read.IsSuccess
            ? SettingsResult<GroupSettings>.Success(new GroupSettings(read.Value))
            : SettingsResult<GroupSettings>.Failure(read.Error);
    }

    /// <summary>
    /// A partial layer of a round or a match. An absent or null leaf (or block) inherits; a leaf the level
    /// does not take is refused, before its type, as is anything the document parser refuses.
    /// </summary>
    public static SettingsResult<SettingsLayer> ParseLayer(SettingsCatalog catalog, SettingsLevel level, SettingsNode node)
    {
        if (level == SettingsLevel.Group)
        {
            throw new ArgumentException("The group is a complete document, not a layer.", nameof(level));
        }

        var read = SettingsTreeReader.Read(catalog, node, requiresBlocks: false, (field, leaf) => ReadLayerLeaf(level, field, leaf));
        return read.IsSuccess
            ? SettingsResult<SettingsLayer>.Success(new SettingsLayer(read.Value))
            : SettingsResult<SettingsLayer>.Failure(read.Error);
    }

    private static LeafReading ReadDocumentLeaf(SettingsField field, SettingsNode? leaf) => leaf switch
    {
        null => LeafReading.Refused(SettingsErrors.MissingField),
        NullNode => LeafReading.Refused(SettingsErrors.WrongType),
        _ => Checked(field, leaf),
    };

    private static LeafReading ReadLayerLeaf(SettingsLevel level, SettingsField field, SettingsNode? leaf)
    {
        if (leaf is null or NullNode)
        {
            return LeafReading.Absent;
        }

        return field.IsAllowedAt(level) ? Checked(field, leaf) : LeafReading.Refused(SettingsErrors.NotAllowedAtLevel);
    }

    private static LeafReading Checked(SettingsField field, SettingsNode leaf) =>
        SettingsValueRules.Check(field, leaf) is { } code
            ? LeafReading.Refused(code)
            : LeafReading.Of(SettingsValue.FromNode(leaf)!);
}
