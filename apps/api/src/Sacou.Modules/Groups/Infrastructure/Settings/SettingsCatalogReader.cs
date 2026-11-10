using System.Collections.Immutable;
using System.Reflection;
using Sacou.Modules.Groups.Domain.Settings;

namespace Sacou.Modules.Groups.Infrastructure.Settings;

/// <summary>
/// Reads settings-catalog.json, built into this assembly (no copy, no disk in production, ADR 0025).
/// A broken catalog is a program error, as in TypeScript: it throws, with the path, and the API does not start.
/// </summary>
internal static class SettingsCatalogReader
{
    public const string ResourceName = "Sacou.Modules.Groups.settings-catalog.json";

    private static readonly string[] RootKeys = ["schemaVersion", "fields", "templates"];
    private static readonly string[] TemplateKeys = ["pro", "values"];

    private static readonly Lazy<SettingsCatalog> Embedded = new(() => Load(typeof(SettingsCatalogReader).Assembly, ResourceName));

    public static SettingsCatalog Catalog => Embedded.Value;

    public static SettingsCatalog Load(Assembly assembly, string resourceName)
    {
        using var stream = assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"Embedded resource \"{resourceName}\" not found.");
        return Parse(SettingsJsonReader.Parse(stream));
    }

    public static SettingsCatalog Parse(SettingsNode node)
    {
        var root = CatalogNodes.Object(node, "catalog", RootKeys);
        if (CatalogNodes.Integer(root.Member("schemaVersion"), "schemaVersion") != SettingsCatalog.SchemaVersion)
        {
            throw CatalogNodes.Invalid("schemaVersion", $"{SettingsCatalog.SchemaVersion}");
        }

        var fields = CatalogNodes.Array(root.Member("fields"), "fields").Select(SettingsFieldReader.Read).ToImmutableArray();
        CheckPaths(fields);
        var templates = CatalogNodes.Object(root.Member("templates"), "templates", SettingsCatalog.TemplateKeys);
        return new SettingsCatalog(
            fields,
            [.. SettingsCatalog.TemplateKeys.Select(key => ReadTemplate(templates.Member(key), key, fields))]);
    }

    /// <summary>Unique paths, with the leaves of a block together.</summary>
    private static void CheckPaths(ImmutableArray<SettingsField> fields)
    {
        if (fields.Select(field => field.Path).Distinct(StringComparer.Ordinal).Count() != fields.Length)
        {
            throw CatalogNodes.Invalid("fields", "unique paths");
        }

        var runs = fields.Select(field => field.Block).Where((block, index) => index == 0 || fields[index - 1].Block != block);
        if (runs.Count() != runs.Distinct(StringComparer.Ordinal).Count())
        {
            throw CatalogNodes.Invalid("fields", "the leaves of a block together");
        }
    }

    private static SettingsTemplate ReadTemplate(SettingsNode? node, string key, ImmutableArray<SettingsField> fields)
    {
        var at = $"templates.{key}";
        var record = CatalogNodes.Object(node, at, TemplateKeys);
        var values = CatalogNodes.Object(record.Member("values"), $"{at}.values", null);
        var read = values.Members.ToImmutableDictionary(
            member => member.Key,
            member => TemplateValue(fields, member.Key, member.Value, $"{at}.values.{member.Key}"),
            StringComparer.Ordinal);
        return new SettingsTemplate(key, CatalogNodes.Boolean(record.Member("pro"), $"{at}.pro"), read);
    }

    private static SettingsValue TemplateValue(ImmutableArray<SettingsField> fields, string path, SettingsNode node, string at)
    {
        var field = fields.FirstOrDefault(candidate => string.Equals(candidate.Path, path, StringComparison.Ordinal));
        if (field is null || field.IsGroupFact || SettingsValueRules.Check(field, node) is not null)
        {
            throw CatalogNodes.Invalid(at, "a valid value of a field that is not a group fact");
        }

        return SettingsValue.FromNode(node)!;
    }
}
