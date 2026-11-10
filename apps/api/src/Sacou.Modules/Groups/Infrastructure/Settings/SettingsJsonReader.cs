using System.Text.Json;
using Sacou.Modules.Groups.Domain.Settings;

namespace Sacou.Modules.Groups.Infrastructure.Settings;

/// <summary>
/// Turns JSON into a <see cref="SettingsNode"/> and decides nothing: the schema belongs to the domain
/// parser (ADR 0041). Malformed JSON, a repeated key, more than <see cref="MaxDepth"/> levels or a
/// lone surrogate in a string throws a <see cref="JsonException"/>: the caller treats it as an invalid body.
/// JavaScript keeps the last of repeated keys; here they are refused, so the two never disagree in silence (ADR 0025).
/// </summary>
internal static class SettingsJsonReader
{
    /// <summary>The default of System.Text.Json, written out so it cannot drift.</summary>
    public const int MaxDepth = 64;

    private static readonly JsonDocumentOptions Options = new() { AllowDuplicateProperties = false, MaxDepth = MaxDepth };

    public static SettingsNode Parse(string json)
    {
        using var document = JsonDocument.Parse(json, Options);
        return Read(document.RootElement);
    }

    public static SettingsNode Parse(Stream utf8Json)
    {
        using var document = JsonDocument.Parse(utf8Json, Options);
        return Read(document.RootElement);
    }

    /// <summary>Recursive, bounded by the depth of the document it reads.</summary>
    public static SettingsNode Read(JsonElement element) => element.ValueKind switch
    {
        JsonValueKind.Object => new ObjectNode([.. element.EnumerateObject().Select(member => KeyValuePair.Create(member.Name, Read(member.Value)))]),
        JsonValueKind.Array => new ArrayNode([.. element.EnumerateArray().Select(Read)]),
        JsonValueKind.String => new TextNode(TextOf(element)),
        JsonValueKind.Number => new NumberNode(element.TryGetDouble(out var number) ? number : double.NaN),
        JsonValueKind.True => new BooleanNode(true),
        JsonValueKind.False => new BooleanNode(false),
        _ => NullNode.Instance,
    };

    /// <summary><c>GetString</c> refuses a lone surrogate, which the text rule would refuse anyway.</summary>
    private static string TextOf(JsonElement element)
    {
        try
        {
            return element.GetString() ?? string.Empty;
        }
        catch (InvalidOperationException)
        {
            throw new JsonException("A string holds a lone surrogate.");
        }
    }
}
