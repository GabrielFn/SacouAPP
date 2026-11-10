using System.Collections.Immutable;
using Sacou.Modules.Groups.Domain.Settings;

namespace Sacou.Modules.Groups.Infrastructure.Settings;

/// <summary>One field of the catalog, read strictly: each type has its own keys, and nothing else.</summary>
internal static class SettingsFieldReader
{
    private static readonly string[] CommonKeys = ["path", "type", "default", "levels", "groupFact", "pro"];
    private static readonly string[] OptionalKeys = ["proValues"];

    private static readonly ImmutableDictionary<string, (SettingsValueType Type, string[] Keys)> Types =
        new Dictionary<string, (SettingsValueType, string[])>(StringComparer.Ordinal)
        {
            ["boolean"] = (SettingsValueType.Boolean, []),
            ["integer"] = (SettingsValueType.Integer, ["min", "max"]),
            ["choice"] = (SettingsValueType.Choice, ["values", "proValues"]),
            ["time"] = (SettingsValueType.Time, []),
            ["text"] = (SettingsValueType.Text, ["maxLength"]),
        }.ToImmutableDictionary(StringComparer.Ordinal);

    public static SettingsField Read(SettingsNode node, int index)
    {
        var at = $"fields.{index}";
        var typeCode = node is ObjectNode candidate ? candidate.Member("type") as TextNode : null;
        if (typeCode is null || !Types.TryGetValue(typeCode.Value, out var type))
        {
            throw CatalogNodes.Invalid($"{at}.type", $"one of {string.Join(", ", Types.Keys)}");
        }

        string[] keys = [.. CommonKeys, .. type.Keys];
        var record = CatalogNodes.Object(node, at, keys);
        var missing = keys.FirstOrDefault(key => !OptionalKeys.Contains(key) && record.Member(key) is null);
        if (missing is not null)
        {
            throw CatalogNodes.Invalid($"{at}.{missing}", "a value");
        }

        return Consistent(Build(record, type.Type, at), at);
    }

    private static SettingsField Build(ObjectNode record, SettingsValueType type, string at)
    {
        var path = CatalogNodes.Text(record.Member("path"), $"{at}.path");
        var parts = path.Split(SettingsErrors.PathSeparator);
        if (parts.Length != 2 || parts.Any(part => part.Length == 0))
        {
            throw CatalogNodes.Invalid($"{at}.path", "a path \"block.leaf\"");
        }

        return new SettingsField(
            path,
            parts[0],
            parts[1],
            type,
            CatalogNodes.Scalar(record.Member("default"), $"{at}.default"),
            [.. CatalogNodes.Array(record.Member("levels"), $"{at}.levels").Select((level, position) => LevelOf(level, $"{at}.levels.{position}"))],
            CatalogNodes.Boolean(record.Member("groupFact"), $"{at}.groupFact"),
            CatalogNodes.Boolean(record.Member("pro"), $"{at}.pro"))
        {
            Min = type == SettingsValueType.Integer ? CatalogNodes.Integer(record.Member("min"), $"{at}.min") : 0,
            Max = type == SettingsValueType.Integer ? CatalogNodes.Integer(record.Member("max"), $"{at}.max") : 0,
            Values = CatalogNodes.Scalars(record.Member("values"), $"{at}.values"),
            ProValues = CatalogNodes.Scalars(record.Member("proValues"), $"{at}.proValues"),
            MaxLength = type == SettingsValueType.Text ? CatalogNodes.Integer(record.Member("maxLength"), $"{at}.maxLength") : 0,
        };
    }

    private static SettingsLevel LevelOf(SettingsNode node, string at) =>
        SettingsLevel.FromCode(CatalogNodes.Text(node, at)) ?? throw CatalogNodes.Invalid(at, "one of group, round, match");

    /// <summary>The default passes its own rule, a group takes every field and Pro values are in the list.</summary>
    private static SettingsField Consistent(SettingsField field, string at)
    {
        if (field.Type == SettingsValueType.Choice && field.Values.IsEmpty)
        {
            throw CatalogNodes.Invalid($"{at}.values", "a list");
        }

        if (SettingsValueRules.Check(field, field.DefaultValue.ToNode()) is not null)
        {
            throw CatalogNodes.Invalid($"{at}.default", "a value its own rule accepts");
        }

        if (field.Levels.IsEmpty || field.Levels[0] != SettingsLevel.Group)
        {
            throw CatalogNodes.Invalid($"{at}.levels", "the group level first");
        }

        return field.ProValues.All(field.Values.Contains) ? field : throw CatalogNodes.Invalid($"{at}.proValues", "values of the list");
    }
}
