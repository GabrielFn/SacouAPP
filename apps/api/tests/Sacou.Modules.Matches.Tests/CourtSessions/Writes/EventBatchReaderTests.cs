using System.Text;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;
using Xunit;
using static Sacou.Modules.Matches.Tests.CourtSessions.Writes.CourtWriteFixture;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Writes;

/// <summary>The structure of the body, read by bytes before any tree (ADR 0060, D8 step 2).</summary>
public sealed class EventBatchReaderTests
{
    private const int LoneSurrogate = 0xD800;

    private static readonly string OneEvent = Envelope(1, ScoreEventTypes.PointScored, Point("a"));

    private static EventBatchError ErrorOf(string body) => ErrorOf(Encoding.UTF8.GetBytes(body));

    private static EventBatchError ErrorOf(byte[] body)
    {
        var result = EventBatchReader.ReadEnvelopes(body);
        Assert.True(result.IsFailure, "Expected a refusal.");
        return result.Error;
    }

    private static string Body(params string[] events) => $$"""{"events":[{{string.Join(",", events)}}]}""";

    /// <summary>An element of exactly <paramref name="length"/> bytes: an object whose single string fills it.</summary>
    private static string ElementOf(int length)
    {
        const string Prefix = """{"x":""" + "\"";
        const string Suffix = "\"}";
        return Prefix + new string('a', length - Prefix.Length - Suffix.Length) + Suffix;
    }

    [Fact]
    public void ValidBody_GivesEachEnvelopeWithItsBytes()
    {
        var result = EventBatchReader.ReadEnvelopes(Encoding.UTF8.GetBytes(Body(OneEvent, Envelope(2, ScoreEventTypes.PointScored, Point("b")))));

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.Length);
        Assert.Equal(Encoding.UTF8.GetByteCount(OneEvent), result.Value[0].Event.ByteCount);
        Assert.Equal(OneEvent, Encoding.UTF8.GetString(result.Value[0].Utf8Json.Span));
        Assert.Equal(EventId(2), result.Value[1].Event.Envelope.EventId);
    }

    [Theory]
    [InlineData("[]", EventBatchError.BodyField)]
    [InlineData("\"events\"", EventBatchError.BodyField)]
    [InlineData("{}", EventBatchError.EventsField)]
    [InlineData("""{"events":{}}""", EventBatchError.EventsField)]
    [InlineData("""{"events":[]}""", EventBatchError.EventsField)]
    [InlineData("""{"Events":[1]}""", EventLogSchema.UnknownEnvelopeField)]
    [InlineData("""{"events":[1],"other":1}""", EventLogSchema.UnknownEnvelopeField)]
    [InlineData("""{"events":[1],"events":[1]}""", EventBatchError.EventsField)]
    [InlineData("""{"events":[1]} {}""", EventBatchError.BodyField)]
    [InlineData("""{"events":[1],}""", EventBatchError.BodyField)]
    [InlineData("""{"events":[1] /* c */}""", EventBatchError.BodyField)]
    [InlineData("""{"events":[1""", EventBatchError.BodyField)]
    public void MalformedStructure_IsABatchInvalid(string body, string field)
    {
        var error = ErrorOf(body);

        Assert.Equal(EventBatchError.BatchInvalidCode, error.Code);
        Assert.Equal(field, error.Field);
        Assert.Null(error.Index);
    }

    [Fact]
    public void AnEscapedSpellingOfTheKey_IsAnotherKey()
    {
        var body = "{\"" + @"\" + "u0065vents\":[1]}";

        Assert.Equal(EventLogSchema.UnknownEnvelopeField, ErrorOf(body).Field);
    }

    [Fact]
    public void MoreThanTheEventsOfARequest_IsABatchInvalid()
    {
        var accepted = EventBatchReader.ReadElements(Encoding.UTF8.GetBytes(Body([.. Enumerable.Repeat("1", CourtStreamLimits.MaxEventsPerRequest)])));
        var error = ErrorOf(Body([.. Enumerable.Repeat("1", CourtStreamLimits.MaxEventsPerRequest + 1)]));

        Assert.True(accepted.IsSuccess);
        Assert.Equal(EventBatchError.BatchInvalidCode, error.Code);
        Assert.Equal(EventBatchError.EventsField, error.Field);
    }

    [Fact]
    public void AnElementOfTheMaximumSize_IsRead_AndOneByteMore_IsTooLarge()
    {
        var atLimit = EventBatchReader.ReadElements(Encoding.UTF8.GetBytes(Body("1", ElementOf(CourtStreamLimits.MaxEnvelopeBytes))));
        var error = ErrorOf(Body("1", ElementOf(CourtStreamLimits.MaxEnvelopeBytes + 1)));

        Assert.True(atLimit.IsSuccess);
        Assert.Equal(CourtStreamLimits.MaxEnvelopeBytes, atLimit.Value[1].Length);
        Assert.Equal(EventBatchError.EventTooLargeCode, error.Code);
        Assert.Equal(1, error.Index);
    }

    /// <summary>Measured by its byte range, so a huge element never reaches the raw reader, which would allocate ~32 times it.</summary>
    [Fact]
    public void AHugeElement_IsTooLargeWithoutBuildingATree()
    {
        const int TenMebibytes = 10 * 1024 * 1024;
        var body = Encoding.UTF8.GetBytes(Body(ElementOf(TenMebibytes)));
        var before = GC.GetAllocatedBytesForCurrentThread();

        var error = ErrorOf(body);

        Assert.Equal(EventBatchError.EventTooLargeCode, error.Code);
        Assert.True(GC.GetAllocatedBytesForCurrentThread() - before < TenMebibytes, "The reader allocated in proportion to the element.");
    }

    [Fact]
    public void DepthAboveTheMaximum_IsABatchInvalid()
    {
        var nested = new string('[', RawValueReader.MaxDepth) + new string(']', RawValueReader.MaxDepth);

        Assert.Equal(EventBatchError.BatchInvalidCode, ErrorOf(Body(nested)).Code);
    }

    [Fact]
    public void InvalidUtf8InAnElement_IsRefused_WithoutItsContent()
    {
        var body = Encoding.UTF8.GetBytes(Body(OneEvent, """{"x":"__"}"""));
        var marker = Array.LastIndexOf(body, (byte)'_');
        body[marker - 1] = 0xC0;
        body[marker] = 0xAF;

        var error = ErrorOf(body);

        Assert.Equal(EventBatchError.InvalidEnvelopeCode, error.Code);
        Assert.Equal(1, error.Index);
        Assert.Equal(EventLogSchema.EnvelopeRootField, error.Field);
    }

    /// <summary>The envelope keeps the payload as is: the score parser of the replay decides about it later.</summary>
    [Fact]
    public void ALoneSurrogateInAPayload_IsReadAsJavaScriptReadsIt()
    {
        var escape = @"\" + "u" + LoneSurrogate.ToString("x4", System.Globalization.CultureInfo.InvariantCulture);
        var payload = Point("a").Replace("}", ",\"x\":\"" + escape + "\"}", StringComparison.Ordinal);

        var result = EventBatchReader.ReadEnvelopes(Encoding.UTF8.GetBytes(Body(Envelope(1, ScoreEventTypes.PointScored, payload))));

        Assert.True(result.IsSuccess);
        Assert.True(result.Value[0].Event.Envelope.Payload.TryGetMember("x", out var value));
        Assert.Equal(((char)LoneSurrogate).ToString(), ((RawString)value).Value);
    }

    [Fact]
    public void AnEnvelopeOutsideTheSchema_NamesTheFieldAndTheIndex()
    {
        var error = ErrorOf(Body(OneEvent, OneEvent.Replace("\"batch\":1", "\"batch\":0", StringComparison.Ordinal)));

        Assert.Equal(EventBatchError.InvalidEnvelopeCode, error.Code);
        Assert.Equal(EnvelopeFields.Batch, error.Field);
        Assert.Equal(1, error.Index);
    }

    [Fact]
    public void Errors_NeverEchoTheInput()
    {
        const string Marker = "a0000000-0000-4000-8000-00000000beef";

        var error = ErrorOf($$"""{"events":[1],"{{Marker}}":1}""");

        Assert.DoesNotContain(Marker, error.ToString(), StringComparison.Ordinal);
        Assert.DoesNotContain(Marker, error.Field ?? string.Empty, StringComparison.Ordinal);
    }
}
