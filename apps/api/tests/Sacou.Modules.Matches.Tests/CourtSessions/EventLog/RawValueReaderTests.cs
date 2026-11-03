using System.Text.Json;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.EventLog;

/// <summary>The adapter only converts: repeated keys reach the domain, and malformed JSON never does.</summary>
public sealed class RawValueReaderTests
{
    private const int HighSurrogate = 0xD800;
    private const int LowSurrogate = 0xDC00;
    private const int AcuteE = 0x00E9;

    [Fact]
    public void MaxDepth_IsReachedBeforeTheParser()
    {
        var atLimit = new string('[', RawValueReader.MaxDepth) + new string(']', RawValueReader.MaxDepth);
        var overLimit = "[" + atLimit + "]";

        Assert.IsType<RawArray>(RawValueReader.Parse(atLimit));
        Assert.ThrowsAny<JsonException>(() => RawValueReader.Parse(overLimit));
    }

    [Theory]
    [InlineData("{")]
    [InlineData("{\"a\":}")]
    [InlineData("")]
    [InlineData("[1,]")]
    [InlineData("NaN")]
    public void MalformedJson_Throws(string json)
    {
        Assert.ThrowsAny<JsonException>(() => RawValueReader.Parse(json));
    }

    [Fact]
    public void RepeatedKeys_AreKept_InTheOrderReceived()
    {
        var record = Assert.IsType<RawObject>(RawValueReader.Parse("""{"a":1,"b":2,"a":3}"""));

        Assert.Equal(["a", "b", "a"], record.Members.Select(member => member.Key));
        Assert.Equal([1d, 2d, 3d], record.Members.Select(member => Assert.IsType<RawNumber>(member.Value).Value));
    }

    [Fact]
    public void LoneSurrogates_AreKept_InKeysAndValues()
    {
        var high = EnvelopeJson.UnicodeEscape(HighSurrogate);
        var low = EnvelopeJson.UnicodeEscape(LowSurrogate);

        var record = Assert.IsType<RawObject>(RawValueReader.Parse($$"""{"{{high}}":"{{low}}x"}"""));

        var member = Assert.Single(record.Members);
        Assert.Equal(((char)HighSurrogate).ToString(), member.Key);
        Assert.Equal(((char)LowSurrogate) + "x", Assert.IsType<RawString>(member.Value).Value);
    }

    [Fact]
    public void Escapes_AreDecoded()
    {
        var slash = EnvelopeJson.Backslash;
        var json = "\"" + string.Concat(
            slash + "\"", slash + slash, slash + "/", slash + "b", slash + "f", slash + "n", slash + "r", slash + "t",
            EnvelopeJson.UnicodeEscape(AcuteE), EnvelopeJson.UnicodeEscape(0xD83D), EnvelopeJson.UnicodeEscape(0xDE00)) + "\"";

        var text = Assert.IsType<RawString>(RawValueReader.Parse(json)).Value;

        Assert.Equal("\"\\/\b\f\n\r\t" + (char)AcuteE + "\U0001F600", text);
    }

    [Fact]
    public void Utf8Text_IsDecoded()
    {
        Assert.Equal("é😀", Assert.IsType<RawString>(RawValueReader.Parse("\"é😀\"")).Value);
    }

    [Theory]
    [InlineData("1e400", double.PositiveInfinity)]
    [InlineData("-1e400", double.NegativeInfinity)]
    [InlineData("2.5e1", 25)]
    [InlineData("25.0", 25)]
    public void Numbers_GoThroughADouble(string json, double expected)
    {
        Assert.Equal(expected, Assert.IsType<RawNumber>(RawValueReader.Parse(json)).Value);
    }

    [Fact]
    public void NegativeZero_IsKept()
    {
        Assert.True(double.IsNegative(Assert.IsType<RawNumber>(RawValueReader.Parse("-0")).Value));
    }

    [Theory]
    [InlineData("null")]
    [InlineData("true")]
    [InlineData("false")]
    public void Literals_AreRead(string json)
    {
        var value = RawValueReader.Parse(json);

        Assert.Equal(json, EnvelopeParserTests.Write(value));
    }

    [Fact]
    public void Bytes_AreReadLikeText()
    {
        var value = RawValueReader.Parse(System.Text.Encoding.UTF8.GetBytes("""{"a":[1,"b"]}"""));

        Assert.Equal("""{"a":[1,"b"]}""", EnvelopeParserTests.Write(value));
    }
}
