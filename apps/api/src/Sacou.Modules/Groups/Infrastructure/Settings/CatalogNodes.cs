using System.Collections.Immutable;
using Sacou.Modules.Groups.Domain.Settings;

namespace Sacou.Modules.Groups.Infrastructure.Settings;

/// <summary>Strict readers of the catalog nodes, with the same message and paths as parse-catalog.ts.</summary>
internal static class CatalogNodes
{
    public static InvalidDataException Invalid(string path, string expected) =>
        new($"Invalid settings catalog at \"{path}\": expected {expected}.");

    /// <param name="node">The node to read.</param>
    /// <param name="path">Where it is, for the message.</param>
    /// <param name="keys">The keys allowed; <c>null</c> lets any key in, for the caller to check.</param>
    public static ObjectNode Object(SettingsNode? node, string path, IReadOnlyCollection<string>? keys)
    {
        if (node is not ObjectNode record)
        {
            throw Invalid(path, "an object");
        }

        var unknown = record.Keys.FirstOrDefault(key => keys is not null && !keys.Contains(key));
        return unknown is null ? record : throw Invalid($"{path}.{unknown}", $"a key among {string.Join(", ", keys!)}");
    }

    public static ImmutableArray<SettingsNode> Array(SettingsNode? node, string path) =>
        node is ArrayNode array ? array.Items : throw Invalid(path, "an array");

    public static bool Boolean(SettingsNode? node, string path) =>
        node is BooleanNode boolean ? boolean.Value : throw Invalid(path, "a boolean");

    public static int Integer(SettingsNode? node, string path) =>
        node is NumberNode { Value: var value } && double.IsFinite(value) && Math.Floor(value) == value
            && value is >= int.MinValue and <= int.MaxValue
            ? (int)value
            : throw Invalid(path, "an integer");

    public static string Text(SettingsNode? node, string path) =>
        node is TextNode text ? text.Value : throw Invalid(path, "a string");

    public static SettingsValue Scalar(SettingsNode? node, string path) =>
        SettingsValue.FromNode(node) ?? throw Invalid(path, "a boolean, a number or a string");

    public static ImmutableArray<SettingsValue> Scalars(SettingsNode? node, string path) =>
        node is null ? [] : [.. Array(node, path).Select((item, index) => Scalar(item, $"{path}.{index}"))];
}
