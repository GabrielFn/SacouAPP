using System.Text.Json;
using System.Text.Json.Serialization;

namespace Sacou.Http;

/// <summary>
/// Enums as camelCase text, never as numbers, and one value per field unless the enum is <c>[Flags]</c>:
/// the built-in converter would read <c>"admin,player"</c> as both values OR-ed together (ADR 0039).
/// </summary>
internal sealed class SingleValueEnumConverter : JsonConverterFactory
{
    private readonly JsonStringEnumConverter text = new(JsonNamingPolicy.CamelCase, allowIntegerValues: false);

    public override bool CanConvert(Type typeToConvert) => text.CanConvert(typeToConvert);

    public override JsonConverter? CreateConverter(Type typeToConvert, JsonSerializerOptions options)
    {
        var inner = text.CreateConverter(typeToConvert, options);
        return typeToConvert.IsDefined(typeof(FlagsAttribute), inherit: false)
            ? inner
            : (JsonConverter?)Activator.CreateInstance(typeof(Strict<>).MakeGenericType(typeToConvert), inner);
    }

    private sealed class Strict<TEnum>(JsonConverter<TEnum> inner) : JsonConverter<TEnum>
        where TEnum : struct, Enum
    {
        private const char Separator = ',';

        public override TEnum Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            Refuse(ref reader);
            return inner.Read(ref reader, typeToConvert, options);
        }

        public override void Write(Utf8JsonWriter writer, TEnum value, JsonSerializerOptions options) =>
            inner.Write(writer, value, options);

        public override TEnum ReadAsPropertyName(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            Refuse(ref reader);
            return inner.ReadAsPropertyName(ref reader, typeToConvert, options);
        }

        public override void WriteAsPropertyName(Utf8JsonWriter writer, TEnum value, JsonSerializerOptions options) =>
            inner.WriteAsPropertyName(writer, value, options);

        private static void Refuse(ref Utf8JsonReader reader)
        {
            if (reader.TokenType is JsonTokenType.String or JsonTokenType.PropertyName
                && reader.GetString()!.Contains(Separator, StringComparison.Ordinal))
            {
                throw new JsonException("One enum value per field.");
            }
        }
    }
}
