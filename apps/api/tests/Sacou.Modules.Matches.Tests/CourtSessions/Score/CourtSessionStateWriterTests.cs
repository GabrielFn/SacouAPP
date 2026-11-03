using System.Text.Json;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Tests.CourtSessions.EventLog;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Score;

/// <summary>The production writer gives the text of <c>JSON.stringify</c>, escapes included (ADR 0033, D6).</summary>
public sealed class CourtSessionStateWriterTests
{
    private const char HighSurrogate = (char)0xD83D;
    private const char LowSurrogate = (char)0xDE00;
    private const char AcuteE = (char)0x00E9;
    private const char Delete = (char)0x007F;
    private const char LineSeparator = (char)0x2028;

    private static readonly string Slash = EnvelopeJson.Backslash;

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("score-events.json");

    public static TheoryData<string> AcceptedIds => new(Cases
        .Where(goldenCase => goldenCase.GetProperty("expected").GetProperty("ok").GetBoolean())
        .Select(GoldenFile.IdOf));

    [Fact]
    public void InitialState_IsWrittenWithEveryKey()
    {
        Assert.Equal(
            """{"currentMatch":null,"finishedMatches":[],"queue":{"players":[],"teams":[]}}""",
            CourtSessionStateWriter.ToJson(CourtSessionState.Initial));
    }

    /// <summary>Byte for byte the compact text of the golden state, which is what JSON.stringify gives.</summary>
    [Theory]
    [MemberData(nameof(AcceptedIds))]
    public void State_IsTheCompactTextOfTheGolden(string id)
    {
        var goldenCase = GoldenFile.SingleCase(Cases, GoldenFile.IdOf, id);

        var written = CourtSessionStateWriter.ToJson(ScoreEventsGolden.Run(goldenCase).State);

        Assert.Equal(Compact(goldenCase.GetProperty("expected").GetProperty("state")), written);
    }

    [Theory]
    [InlineData("plain", "\"plain\"")]
    [InlineData("", "\"\"")]
    public void Text_WithoutEscapes_IsQuoted(string text, string expected)
    {
        Assert.Equal(expected, CourtSessionStateWriter.QuoteText(text));
    }

    [Fact]
    public void Text_IsEscapedAsJsonStringifyDoes()
    {
        var text = string.Concat("\"", Slash, "\b\f\n\r\t", "\u0001", "\u001f", Delete, AcuteE, LineSeparator, HighSurrogate, LowSurrogate);
        var expected = "\"" + string.Concat(
            Slash + "\"",
            Slash + Slash,
            Slash + "b", Slash + "f", Slash + "n", Slash + "r", Slash + "t",
            Slash + "u0001",
            Slash + "u001f",
            Delete, AcuteE, LineSeparator, HighSurrogate, LowSurrogate) + "\"";

        Assert.Equal(expected, CourtSessionStateWriter.QuoteText(text));
    }

    [Theory]
    [InlineData(new[] { 0xD800 }, "d800")]
    [InlineData(new[] { 0xDC00 }, "dc00")]
    [InlineData(new[] { 0xDE00, 0xD83D }, "de00", "d83d")]
    [InlineData(new[] { 0xD83D, 0x0061 }, "d83d", "")]
    public void LoneSurrogate_IsEscapedInLowercase_AndNeverThrows(int[] codeUnits, string first, string second = "")
    {
        var text = new string([.. codeUnits.Select(codeUnit => (char)codeUnit)]);
        var escapedFirst = Slash + "u" + first;
        var rest = second.Length > 0 ? Slash + "u" + second : text[1..];

        Assert.Equal("\"" + escapedFirst + rest + "\"", CourtSessionStateWriter.QuoteText(text));
    }

    /// <summary>The text the writer gives for a lone surrogate reads back as the same code unit.</summary>
    [Fact]
    public void LoneSurrogate_ReadsBackAsTheSameText()
    {
        var text = "a" + (char)0xD800 + "b";

        var roundTrip = Assert.IsType<Domain.CourtSessions.EventLog.RawString>(RawValueReader.Parse(CourtSessionStateWriter.QuoteText(text)));

        Assert.Equal(text, roundTrip.Value);
    }

    private static string Compact(JsonElement element)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            element.WriteTo(writer);
        }

        return System.Text.Encoding.UTF8.GetString(stream.ToArray());
    }
}
