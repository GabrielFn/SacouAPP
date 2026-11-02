using System.Globalization;
using System.Text;
using System.Text.Json.Nodes;
using Sacou.Modules.Matches.Domain.Formations;
using Sacou.Modules.Matches.FormationCatalogs;

namespace Sacou.Modules.Matches.Tests.FormationCatalogs;

/// <summary>The real catalog, changed by one thing at a time, with the parser run under a comma-decimal culture.</summary>
internal static class CatalogText
{
    public static readonly CultureInfo CommaDecimalCulture = new("pt-BR");

    public static readonly string Original = ReadOriginal();

    public static string WithValue(string dottedPath, string rawJson)
    {
        var root = Root();
        Parent(root, dottedPath)[LastKey(dottedPath)] = JsonNode.Parse(rawJson);
        return root.ToJsonString();
    }

    /// <summary>For keys that hold a dot themselves, which a dotted path cannot reach.</summary>
    public static string WithMember(string dottedPathOfObject, string key, string rawJson)
    {
        var root = Root();
        Navigate(root, dottedPathOfObject)[key] = JsonNode.Parse(rawJson);
        return root.ToJsonString();
    }

    public static string Without(string dottedPath)
    {
        var root = Root();
        Parent(root, dottedPath).Remove(LastKey(dottedPath));
        return root.ToJsonString();
    }

    public static string WithReversedKeys() => Reversed(Root())!.ToJsonString();

    /// <summary>For what a JSON tree cannot express, such as a repeated or an escaped key.</summary>
    public static string ReplacingFirst(string oldText, string newText)
    {
        var index = Original.IndexOf(oldText, StringComparison.Ordinal);
        return index < 0
            ? throw new InvalidOperationException($"\"{oldText}\" is not in the catalog.")
            : string.Concat(Original.AsSpan(0, index), newText, Original.AsSpan(index + oldText.Length));
    }

    public static FormationCatalog Parse(string json)
    {
        var previous = CultureInfo.CurrentCulture;
        CultureInfo.CurrentCulture = CommaDecimalCulture;
        try
        {
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(json));
            return FormationCatalogParser.Parse(stream);
        }
        finally
        {
            CultureInfo.CurrentCulture = previous;
        }
    }

    private static string ReadOriginal()
    {
        using var stream = typeof(FormationCatalog).Assembly.GetManifestResourceStream(EmbeddedFormationCatalog.ResourceName)!;
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd();
    }

    private static JsonObject Root() => JsonNode.Parse(Original)!.AsObject();

    private static JsonObject Parent(JsonObject root, string dottedPath) =>
        Navigate(root, string.Join('.', dottedPath.Split('.')[..^1]));

    private static string LastKey(string dottedPath) => dottedPath.Split('.')[^1];

    private static JsonObject Navigate(JsonObject root, string dottedPath) =>
        dottedPath.Split('.', StringSplitOptions.RemoveEmptyEntries).Aggregate(root, (node, key) => node[key]!.AsObject());

    private static JsonNode? Reversed(JsonNode? node) => node switch
    {
        JsonObject record => new JsonObject(
            Enumerable.Reverse(record).Select(member => KeyValuePair.Create(member.Key, Reversed(member.Value)))),
        JsonArray items => new JsonArray([.. items.Select(Reversed)]),
        _ => node?.DeepClone(),
    };
}
