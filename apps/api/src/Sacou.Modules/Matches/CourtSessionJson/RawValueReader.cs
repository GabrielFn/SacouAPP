using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;

namespace Sacou.Modules.Matches.CourtSessionJson;

/// <summary>
/// Turns JSON text into a <see cref="RawValue"/> and decides nothing: repeated keys, depth, size and
/// schema belong to the domain parser (ADR 0033, D2). Text is unescaped here from the raw bytes,
/// because <c>GetString</c> throws on a lone surrogate such as <c>"\ud800"</c>, which JavaScript
/// accepts. Malformed JSON, malformed UTF-8, a raw lone surrogate in the text, or more than <see cref="MaxDepth"/> levels, throws a
/// <see cref="JsonException"/> before the domain sees anything: the caller treats it as an invalid body.
/// </summary>
internal static class RawValueReader
{
    /// <summary>The default of System.Text.Json, written out so it cannot drift.</summary>
    public const int MaxDepth = 64;

    private const char Backslash = '\\';
    private const char Quote = '"';
    private const int UnicodeEscapeDigits = 4;
    private const string InvalidTextMessage = "The JSON text is not valid UTF-8 or UTF-16.";

    /// <summary>Throws on malformed bytes instead of turning them into U+FFFD.</summary>
    private static readonly UTF8Encoding StrictUtf8 = new(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);

    private static readonly JsonDocumentOptions DocumentOptions = new()
    {
        AllowDuplicateProperties = true,
        MaxDepth = MaxDepth,
    };

    /// <summary>Text with a raw lone surrogate cannot become UTF-8, so it is malformed JSON too.</summary>
    public static RawValue Parse(string json)
    {
        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(json, DocumentOptions);
        }
        catch (ArgumentException)
        {
            // Not forwarded: the message names the offending character and its position.
            throw new JsonException(InvalidTextMessage);
        }

        using (document)
        {
            return Read(document.RootElement);
        }
    }

    public static RawValue Parse(ReadOnlyMemory<byte> utf8Json)
    {
        using var document = JsonDocument.Parse(utf8Json, DocumentOptions);
        return Read(document.RootElement);
    }

    /// <summary>Recursive, bounded by <see cref="MaxDepth"/> of the document it reads.</summary>
    private static RawValue Read(JsonElement element) => element.ValueKind switch
    {
        JsonValueKind.Object => new RawObject([.. element.EnumerateObject().Select(ReadMember)]),
        JsonValueKind.Array => new RawArray([.. element.EnumerateArray().Select(Read)]),
        JsonValueKind.String => new RawString(Unescape(StringContent(JsonMarshal.GetRawUtf8Value(element)))),
        JsonValueKind.Number => new RawNumber(ReadNumber(element)),
        JsonValueKind.True => RawBoolean.True,
        JsonValueKind.False => RawBoolean.False,
        _ => RawNull.Instance,
    };

    private static RawMember ReadMember(JsonProperty property) =>
        new(Unescape(JsonMarshal.GetRawUtf8PropertyName(property)), Read(property.Value));

    /// <summary>
    /// <c>1e400</c> reads as Infinity, like JSON.parse. Anything a double cannot hold becomes NaN; the
    /// domain refuses both, because it only takes finite numbers.
    /// </summary>
    private static double ReadNumber(JsonElement element) =>
        element.TryGetDouble(out var number) ? number : double.NaN;

    /// <summary>The raw value of a string holds its quotes.</summary>
    private static ReadOnlySpan<byte> StringContent(ReadOnlySpan<byte> rawValue) => rawValue[1..^1];

    /// <summary>
    /// The reader checked the escapes, but not the UTF-8 inside strings and keys: malformed bytes, such
    /// as an overlong form, an encoded surrogate or a cut sequence, are refused here as malformed JSON.
    /// Escapes are ASCII, so they can be undone after decoding. A <c>\u</c> escape becomes its UTF-16 code unit as is,
    /// which keeps a lone surrogate, as JSON.parse does.
    /// </summary>
    private static string Unescape(ReadOnlySpan<byte> rawUtf8)
    {
        var text = DecodeStrictly(rawUtf8);
        if (!text.Contains(Backslash, StringComparison.Ordinal))
        {
            return text;
        }

        var builder = new StringBuilder(text.Length);
        for (var index = 0; index < text.Length; index++)
        {
            if (text[index] != Backslash)
            {
                builder.Append(text[index]);
                continue;
            }

            index++;
            if (text[index] == 'u')
            {
                builder.Append((char)int.Parse(
                    text.AsSpan(index + 1, UnicodeEscapeDigits),
                    NumberStyles.AllowHexSpecifier,
                    CultureInfo.InvariantCulture));
                index += UnicodeEscapeDigits;
                continue;
            }

            builder.Append(SimpleEscape(text[index]));
        }

        return builder.ToString();
    }

    private static string DecodeStrictly(ReadOnlySpan<byte> rawUtf8)
    {
        try
        {
            return StrictUtf8.GetString(rawUtf8);
        }
        catch (DecoderFallbackException)
        {
            throw new JsonException(InvalidTextMessage);
        }
    }

    private static char SimpleEscape(char escaped) => escaped switch
    {
        'b' => '\b',
        'f' => '\f',
        'n' => '\n',
        'r' => '\r',
        't' => '\t',
        Quote or Backslash or '/' => escaped,
        _ => throw new JsonException("Unexpected escape after validation."),
    };
}
