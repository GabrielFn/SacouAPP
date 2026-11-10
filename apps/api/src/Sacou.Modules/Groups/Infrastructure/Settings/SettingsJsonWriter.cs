using System.Text;
using System.Text.Json;
using Sacou.Modules.Groups.Domain.Settings;

namespace Sacou.Modules.Groups.Infrastructure.Settings;

/// <summary>A <see cref="SettingsNode"/> back to JSON text: what the jsonb column stores and the API answers. Members keep the order of the node.</summary>
internal static class SettingsJsonWriter
{
    public static string Write(SettingsNode node)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            WriteNode(writer, node);
        }

        return Encoding.UTF8.GetString(stream.ToArray());
    }

    private static void WriteNode(Utf8JsonWriter writer, SettingsNode node)
    {
        switch (node)
        {
            case ObjectNode objectNode:
                writer.WriteStartObject();
                foreach (var member in objectNode.Members)
                {
                    writer.WritePropertyName(member.Key);
                    WriteNode(writer, member.Value);
                }

                writer.WriteEndObject();
                break;
            case ArrayNode arrayNode:
                writer.WriteStartArray();
                foreach (var item in arrayNode.Items)
                {
                    WriteNode(writer, item);
                }

                writer.WriteEndArray();
                break;
            case TextNode text:
                writer.WriteStringValue(text.Value);
                break;
            case NumberNode number:
                writer.WriteNumberValue(number.Value);
                break;
            case BooleanNode boolean:
                writer.WriteBooleanValue(boolean.Value);
                break;
            default:
                writer.WriteNullValue();
                break;
        }
    }
}
