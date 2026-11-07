using System.Globalization;
using System.Text;

namespace Sacou.Modules.Matches.CourtSessionJson;

/// <summary>
/// Escapes text as <c>JSON.stringify</c> does in TypeScript, lone surrogates included, which
/// <see cref="System.Text.Json.Utf8JsonWriter"/> refuses (ADR 0033, D6).
/// </summary>
internal static class JsonStringifyText
{
    private const char QuoteMark = '"';
    private const char Backslash = '\\';
    private const char FirstPrintable = ' ';
    private const string UnicodeEscapeFormat = "x4";

    /// <summary>The text of a JSON string as <c>JSON.stringify</c> writes it, quotes included.</summary>
    public static string Quote(string text)
    {
        ArgumentNullException.ThrowIfNull(text);
        var builder = new StringBuilder(text.Length + 2);
        builder.Append(QuoteMark);
        for (var index = 0; index < text.Length; index++)
        {
            AppendEscaped(builder, text, index);
        }

        return builder.Append(QuoteMark).ToString();
    }

    /// <summary>
    /// The escapes of <c>JSON.stringify</c>: quote, backslash and the short forms; any other control
    /// character and any lone surrogate as a lowercase <c>\u</c>; everything else as it is.
    /// </summary>
    private static void AppendEscaped(StringBuilder builder, string text, int index)
    {
        var character = text[index];
        var escaped = character switch
        {
            QuoteMark => "\\\"",
            Backslash => "\\\\",
            '\b' => "\\b",
            '\f' => "\\f",
            '\n' => "\\n",
            '\r' => "\\r",
            '\t' => "\\t",
            _ when character < FirstPrintable || IsLoneSurrogate(text, index) => UnicodeEscape(character),
            _ => null,
        };
        if (escaped is null)
        {
            builder.Append(character);
            return;
        }

        builder.Append(escaped);
    }

    private static bool IsLoneSurrogate(string text, int index)
    {
        var character = text[index];
        if (char.IsHighSurrogate(character))
        {
            return index + 1 >= text.Length || !char.IsLowSurrogate(text[index + 1]);
        }

        return char.IsLowSurrogate(character) && (index == 0 || !char.IsHighSurrogate(text[index - 1]));
    }

    private static string UnicodeEscape(char character) =>
        @"\u" + ((int)character).ToString(UnicodeEscapeFormat, CultureInfo.InvariantCulture);
}
