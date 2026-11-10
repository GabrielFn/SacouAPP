using System.Collections.Immutable;

namespace Sacou.Modules.Groups.Domain.Settings;

/// <summary>What a parser does with one leaf: a value, nothing (it inherits) or a refusal.</summary>
internal sealed record LeafReading(SettingsValue? Value, string? ErrorCode)
{
    public static readonly LeafReading Absent = new(null, null);

    public static LeafReading Of(SettingsValue value) => new(value, null);

    public static LeafReading Refused(string code) => new(null, code);
}

/// <summary>
/// Walks the catalog, not the input, the same as parse-tree.ts: blocks and leaves in catalog order, so
/// the first refusal is the same in TypeScript and C#, whatever the order of the keys received.
/// </summary>
internal static class SettingsTreeReader
{
    /// <param name="catalog">The fields to walk.</param>
    /// <param name="node">The input, as received.</param>
    /// <param name="requiresBlocks">A document needs every block; a layer takes an absent or null block as empty.</param>
    /// <param name="readLeaf">The leaf, its node (null when absent) and the field.</param>
    public static SettingsResult<ImmutableDictionary<string, SettingsValue>> Read(
        SettingsCatalog catalog,
        SettingsNode node,
        bool requiresBlocks,
        Func<SettingsField, SettingsNode?, LeafReading> readLeaf)
    {
        if (CheckRoot(catalog, node) is { } rootError)
        {
            return SettingsResult<ImmutableDictionary<string, SettingsValue>>.Failure(rootError);
        }

        var root = (ObjectNode)node;
        var values = ImmutableDictionary.CreateBuilder<string, SettingsValue>(StringComparer.Ordinal);
        foreach (var block in catalog.Blocks)
        {
            if (ReadBlock(catalog, root, block, requiresBlocks, readLeaf, values) is { } error)
            {
                return SettingsResult<ImmutableDictionary<string, SettingsValue>>.Failure(error);
            }
        }

        return SettingsResult<ImmutableDictionary<string, SettingsValue>>.Success(values.ToImmutable());
    }

    private static SettingsError? CheckRoot(SettingsCatalog catalog, SettingsNode node)
    {
        if (node is not ObjectNode root)
        {
            return new SettingsError(SettingsErrors.WrongType, SettingsErrors.RootPath);
        }

        if (root.Member(SettingsErrors.SchemaVersionKey) is not NumberNode { Value: SettingsCatalog.SchemaVersion })
        {
            return new SettingsError(SettingsErrors.UnsupportedVersion, SettingsErrors.SchemaVersionKey);
        }

        var hasUnknownKey = root.Keys.Any(key =>
            !string.Equals(key, SettingsErrors.SchemaVersionKey, StringComparison.Ordinal) && !catalog.Blocks.Contains(key));
        return hasUnknownKey ? new SettingsError(SettingsErrors.UnknownField, SettingsErrors.RootPath) : null;
    }

    private static SettingsError? ReadBlock(
        SettingsCatalog catalog,
        ObjectNode root,
        string block,
        bool requiresBlocks,
        Func<SettingsField, SettingsNode?, LeafReading> readLeaf,
        ImmutableDictionary<string, SettingsValue>.Builder values)
    {
        var raw = root.Member(block);
        if (raw is null or NullNode)
        {
            var code = raw is null ? SettingsErrors.MissingField : SettingsErrors.WrongType;
            return requiresBlocks ? new SettingsError(code, block) : null;
        }

        if (raw is not ObjectNode leaves)
        {
            return new SettingsError(SettingsErrors.WrongType, block);
        }

        var fields = catalog.FieldsOf(block).ToList();
        if (leaves.Keys.Any(key => !fields.Exists(field => string.Equals(field.Leaf, key, StringComparison.Ordinal))))
        {
            return new SettingsError(SettingsErrors.UnknownField, block);
        }

        foreach (var field in fields)
        {
            var reading = readLeaf(field, leaves.Member(field.Leaf));
            if (reading.ErrorCode is { } errorCode)
            {
                return new SettingsError(errorCode, field.Path);
            }

            if (reading.Value is { } value)
            {
                values.Add(field.Path, value);
            }
        }

        return null;
    }
}
