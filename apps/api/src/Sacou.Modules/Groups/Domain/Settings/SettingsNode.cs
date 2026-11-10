using System.Collections.Immutable;

namespace Sacou.Modules.Groups.Domain.Settings;

/// <summary>
/// A JSON value as the domain sees it, without System.Text.Json: the reader in Infrastructure builds it
/// and decides nothing, and the parsers here decide everything (ADR 0041). Numbers are doubles, as in
/// JavaScript: <c>25.0</c> is 25 and <c>1e400</c> is Infinity, which the rules refuse.
/// </summary>
internal abstract record SettingsNode;

internal sealed record NullNode : SettingsNode
{
    public static readonly NullNode Instance = new();

    private NullNode()
    {
    }
}

internal sealed record BooleanNode(bool Value) : SettingsNode;

internal sealed record NumberNode(double Value) : SettingsNode;

internal sealed record TextNode(string Value) : SettingsNode;

internal sealed record ArrayNode(ImmutableArray<SettingsNode> Items) : SettingsNode;

/// <summary>Members in the order received; a repeated key never gets here (the reader refuses it).</summary>
internal sealed record ObjectNode(ImmutableArray<KeyValuePair<string, SettingsNode>> Members) : SettingsNode
{
    public static readonly ObjectNode Empty = new(ImmutableArray<KeyValuePair<string, SettingsNode>>.Empty);

    /// <summary>Ordinal match, as JavaScript reads own keys.</summary>
    public SettingsNode? Member(string name) =>
        Members.FirstOrDefault(member => string.Equals(member.Key, name, StringComparison.Ordinal)).Value;

    public IEnumerable<string> Keys => Members.Select(member => member.Key);
}
