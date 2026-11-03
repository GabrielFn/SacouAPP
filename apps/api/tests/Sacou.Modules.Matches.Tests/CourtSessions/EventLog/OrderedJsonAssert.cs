using System.Buffers;
using System.Globalization;
using System.Text.Json;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.EventLog;

/// <summary>
/// The C# side of <c>JSON.stringify(outcome) === JSON.stringify(expected)</c> (ADR 0033, D7): the
/// outcome is written with <see cref="Utf8JsonWriter"/>, read back, and compared node by node with the
/// golden. Kind, key sequence, text by code unit and numbers by value must match, so key order is part
/// of the contract without depending on how each encoder escapes. Messages name the path, never a value.
/// </summary>
internal static class OrderedJsonAssert
{
    private const string Root = "$";

    public static void Equal(JsonElement expected, Action<Utf8JsonWriter> writeActual, string context) =>
        Compare(expected, writeActual, context, ignoreKeyOrder: false);

    /// <summary>Like <c>toStrictEqual</c> alone: the same tree, with keys in any order.</summary>
    public static void EqualIgnoringKeyOrder(JsonElement expected, Action<Utf8JsonWriter> writeActual, string context) =>
        Compare(expected, writeActual, context, ignoreKeyOrder: true);

    private static void Compare(JsonElement expected, Action<Utf8JsonWriter> writeActual, string context, bool ignoreKeyOrder)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer))
        {
            writeActual(writer);
        }

        using var actual = JsonDocument.Parse(buffer.WrittenMemory);
        AssertNode(expected, actual.RootElement, $"{context}:{Root}", ignoreKeyOrder);
    }

    public static void WriteRaw(Utf8JsonWriter writer, RawValue value)
    {
        switch (value)
        {
            case RawNull:
                writer.WriteNullValue();
                break;
            case RawBoolean boolean:
                writer.WriteBooleanValue(boolean.Value);
                break;
            case RawNumber number:
                writer.WriteNumberValue(number.Value);
                break;
            case RawString text:
                writer.WriteStringValue(text.Value);
                break;
            case RawArray array:
                writer.WriteStartArray();
                foreach (var item in array.Items)
                {
                    WriteRaw(writer, item);
                }

                writer.WriteEndArray();
                break;
            case RawObject record:
                writer.WriteStartObject();
                foreach (var member in record.Members)
                {
                    writer.WritePropertyName(member.Key);
                    WriteRaw(writer, member.Value);
                }

                writer.WriteEndObject();
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(value), "Unknown raw value.");
        }
    }

    private static void AssertNode(JsonElement expected, JsonElement actual, string path, bool ignoreKeyOrder)
    {
        Assert.True(expected.ValueKind == actual.ValueKind, $"{path}: expected {expected.ValueKind}, got {actual.ValueKind}.");
        switch (expected.ValueKind)
        {
            case JsonValueKind.Object:
                AssertObject(expected, actual, path, ignoreKeyOrder);
                break;
            case JsonValueKind.Array:
                AssertArray(expected, actual, path, ignoreKeyOrder);
                break;
            case JsonValueKind.String:
                Assert.True(string.Equals(expected.GetString(), actual.GetString(), StringComparison.Ordinal), $"{path}: text differs.");
                break;
            case JsonValueKind.Number:
                Assert.True(expected.GetDouble() == actual.GetDouble(), $"{path}: number differs.");
                break;
            default:
                break;
        }
    }

    private static void AssertObject(JsonElement expected, JsonElement actual, string path, bool ignoreKeyOrder)
    {
        var expectedMembers = MembersOf(expected, ignoreKeyOrder);
        var actualMembers = MembersOf(actual, ignoreKeyOrder);
        Assert.True(
            expectedMembers.Select(member => member.Name).SequenceEqual(actualMembers.Select(member => member.Name), StringComparer.Ordinal),
            $"{path}: keys differ, in name or order.");
        foreach (var (first, second) in expectedMembers.Zip(actualMembers))
        {
            AssertNode(first.Value, second.Value, $"{path}.{first.Name}", ignoreKeyOrder);
        }
    }

    private static void AssertArray(JsonElement expected, JsonElement actual, string path, bool ignoreKeyOrder)
    {
        Assert.True(expected.GetArrayLength() == actual.GetArrayLength(), $"{path}: lengths differ.");
        var index = 0;
        foreach (var (first, second) in expected.EnumerateArray().Zip(actual.EnumerateArray()))
        {
            AssertNode(first, second, $"{path}[{index.ToString(CultureInfo.InvariantCulture)}]", ignoreKeyOrder);
            index++;
        }
    }

    private static List<JsonProperty> MembersOf(JsonElement record, bool ignoreKeyOrder) =>
        ignoreKeyOrder
            ? [.. record.EnumerateObject().OrderBy(member => member.Name, StringComparer.Ordinal)]
            : [.. record.EnumerateObject()];
}
