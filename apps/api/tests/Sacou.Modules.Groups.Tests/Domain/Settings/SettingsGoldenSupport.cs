using System.Globalization;
using System.Text.Json;
using Sacou.Modules.Groups.Domain.Settings;
using Sacou.Modules.Groups.Infrastructure.Settings;
using Xunit;

namespace Sacou.Modules.Groups.Tests.Domain.Settings;

/// <summary>Reads the inputs of the shared golden file the same way settings.golden.test.ts does.</summary>
internal static class SettingsGoldenSupport
{
    public static SettingsCatalog Catalog => SettingsCatalogReader.Catalog;

    public static SettingsNode Node(JsonElement element) => SettingsJsonReader.Read(element);

    public static bool Has(JsonElement record, string name) => record.TryGetProperty(name, out _);

    /// <summary>The raw document a spec describes: a template over "Do zero", then leaves set or removed.</summary>
    public static SettingsNode RawDocument(JsonElement spec)
    {
        if (spec.TryGetProperty("raw", out var raw))
        {
            return Node(raw);
        }

        var template = Catalog.TemplateOf(spec.TryGetProperty("template", out var key) ? key.GetString()! : "do-zero")!;
        SettingsNode document = SettingsTree.ToNode(Catalog, SettingsResolver.ApplyTemplate(Catalog, SettingsResolver.Defaults(Catalog), template));
        if (spec.TryGetProperty("set", out var set))
        {
            document = set.EnumerateObject().Aggregate(document, (current, leaf) => Edit(current, leaf.Name.Split('.'), Node(leaf.Value)));
        }

        if (spec.TryGetProperty("remove", out var remove))
        {
            document = remove.EnumerateArray().Aggregate(document, (current, path) => Edit(current, path.GetString()!.Split('.'), null));
        }

        return document;
    }

    public static GroupSettings Group(JsonElement spec)
    {
        var parsed = SettingsParser.ParseGroupSettings(Catalog, RawDocument(spec));
        Assert.True(parsed.IsSuccess, parsed.IsSuccess ? string.Empty : $"Golden group did not parse: {parsed.Error}");
        return parsed.Value;
    }

    public static SettingsLayer? Layer(JsonElement record, string property, SettingsLevel level)
    {
        if (!record.TryGetProperty(property, out var raw))
        {
            return null;
        }

        var parsed = SettingsParser.ParseLayer(Catalog, level, Node(raw));
        Assert.True(parsed.IsSuccess, parsed.IsSuccess ? string.Empty : $"Golden layer did not parse: {parsed.Error}");
        return parsed.Value;
    }

    public static SettingsValue Value(JsonElement element) =>
        SettingsValue.FromNode(Node(element)) ?? throw new InvalidOperationException("Expected a scalar.");

    /// <summary>A canonical text of a node, keys in their order, to compare trees.</summary>
    public static string Describe(SettingsNode node) => node switch
    {
        ObjectNode record => "{" + string.Join(",", record.Members.Select(member => $"{member.Key}:{Describe(member.Value)}")) + "}",
        ArrayNode array => "[" + string.Join(",", array.Items.Select(Describe)) + "]",
        NumberNode number => number.Value.ToString("R", CultureInfo.InvariantCulture),
        BooleanNode boolean => boolean.Value ? "true" : "false",
        TextNode text => "\"" + text.Value + "\"",
        _ => "null",
    };

    /// <summary>A copy with the node at <paramref name="keys"/> replaced, or dropped when <paramref name="value"/> is null.</summary>
    private static ObjectNode Edit(SettingsNode node, string[] keys, SettingsNode? value)
    {
        var record = (ObjectNode)node;
        var key = keys[0];
        var child = keys.Length == 1 ? value : Edit(record.Member(key)!, keys[1..], value);
        var members = record.Members
            .Where(member => member.Key != key || child is not null)
            .Select(member => member.Key == key ? KeyValuePair.Create(key, child!) : member)
            .ToList();
        if (child is not null && record.Member(key) is null)
        {
            members.Add(KeyValuePair.Create(key, child));
        }

        return new ObjectNode([.. members]);
    }
}
