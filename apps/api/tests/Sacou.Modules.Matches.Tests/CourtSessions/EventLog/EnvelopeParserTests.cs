using System.Globalization;
using System.Text.Json;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.EventLog;

/// <summary>Port of <c>parse-envelope.test.ts</c>, plus what only C# can get wrong (ADR 0033).</summary>
public sealed class EnvelopeParserTests
{
    private const string Canary = "CANARY-fictional.player@example.com";
    private const int HighSurrogate = 0xD800;
    private const int LowSurrogate = 0xDC00;
    private const string GrinningFace = "\U0001F600";
    private const long LargestSafeInteger = 9_007_199_254_740_991;
    private const int ItemsOverTheBudget = 5_000;

    /// <summary>The payload and the member holding the list are two nodes of the budget.</summary>
    private const int NodesAroundAList = 2;

    public static TheoryData<string> ForbiddenNames => new("email", "name", "nickname", "phone", "pix", "photo", "userId");

    [Fact]
    public void Schema_IsExactlyTheEightAgreedFields()
    {
        Assert.Equal(
            ["batch", "courtSessionId", "deviceId", "eventId", "payload", "schemaVersion", "sequence", "type"],
            EnvelopeFields.All.Order(StringComparer.Ordinal));
    }

    /// <summary>Security review A4: a new property needs a parser field, in the same order.</summary>
    [Fact]
    public void EnvelopeRecord_HasExactlyTheSchemaFields_InOrder()
    {
        var properties = typeof(EventEnvelope).GetConstructors().Single().GetParameters()
            .Select(parameter => char.ToLowerInvariant(parameter.Name![0]) + parameter.Name[1..]);

        Assert.Equal(EnvelopeFields.All, properties);
        Assert.Equal(
            EnvelopeFields.All.Length,
            typeof(EventEnvelope).GetProperties().Count(property => property.Name != "EqualityContract"));
    }

    [Fact]
    public void ValidEnvelope_IsAccepted_WithEveryField()
    {
        var envelope = EnvelopeJson.ParseValid(EnvelopeJson.Valid());

        Assert.Equal(EnvelopeJson.EventId(1), envelope.EventId);
        Assert.Equal(EnvelopeJson.Court, envelope.CourtSessionId);
        Assert.Equal(EnvelopeJson.Device, envelope.DeviceId);
        Assert.Equal(1, envelope.Batch);
        Assert.Equal(1, envelope.Sequence);
        Assert.Equal(EventLogSchema.CurrentEventSchemaVersion, envelope.SchemaVersion);
        Assert.Equal(AppendFixture.FixtureAppended, envelope.Type);
        Assert.Equal("""{"value":"a"}""", Write(envelope.Payload));
    }

    [Theory]
    [MemberData(nameof(ForbiddenNames))]
    public void ForbiddenField_IsUnknown_EvenWhenEmpty(string name)
    {
        Assert.DoesNotContain(name, EnvelopeFields.All);
        EnvelopeJson.AssertInvalid(EnvelopeJson.WithExtra(name, "\"fictional\""), EventLogSchema.UnknownEnvelopeField);
        EnvelopeJson.AssertInvalid(EnvelopeJson.WithExtra(name, "null"), EventLogSchema.UnknownEnvelopeField);
    }

    [Theory]
    [InlineData("memberName")]
    [InlineData("Email")]
    [InlineData("USERID")]
    [InlineData("user_id")]
    [InlineData("memberId")]
    [InlineData("createdAt")]
    [InlineData("")]
    [InlineData("__proto__")]
    [InlineData("constructor")]
    [InlineData("toString")]
    [InlineData("1")]
    [InlineData("EventId")]
    public void UnknownField_IsRejected(string name)
    {
        EnvelopeJson.AssertInvalid(EnvelopeJson.WithExtra(name, "{}"), EventLogSchema.UnknownEnvelopeField);
    }

    [Fact]
    public void UnknownField_IsCheckedBeforeTheFields()
    {
        EnvelopeJson.AssertInvalid(
            EnvelopeJson.Object([(EnvelopeFields.EventId, "1"), ("memberName", "1")]),
            EventLogSchema.UnknownEnvelopeField);
    }

    [Fact]
    public void UnknownField_IsNeverEchoed()
    {
        var parsed = EnvelopeJson.Parse(EnvelopeJson.WithExtra(Canary, "1"));

        Assert.True(parsed.IsFailure);
        Assert.DoesNotContain(Canary, parsed.ToString(), StringComparison.Ordinal);
        Assert.DoesNotContain(Canary, parsed.Error.ToString(), StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("null")]
    [InlineData("1")]
    [InlineData("\"x\"")]
    [InlineData("true")]
    [InlineData("[]")]
    public void NotAnObject_IsRejectedAsTheEnvelope(string json)
    {
        EnvelopeJson.AssertInvalid(json, EventLogSchema.EnvelopeRootField);
    }

    [Theory]
    [InlineData("eventId")]
    [InlineData("batch")]
    [InlineData("payload")]
    public void RepeatedEnvelopeField_IsRejectedAsTheEnvelope_EvenWithTheSameValue(string field)
    {
        var value = EnvelopeJson.ValidFields().Single(member => member.Key == field).Value;

        EnvelopeJson.AssertInvalid(EnvelopeJson.WithExtra(field, value), EventLogSchema.EnvelopeRootField);
    }

    [Fact]
    public void RepeatedEnvelopeField_WrittenWithAnEscape_IsRejected()
    {
        var escapedBatch = EnvelopeJson.UnicodeEscape('b') + "atch";

        EnvelopeJson.AssertInvalid(EnvelopeJson.WithExtra(escapedBatch, "1"), EventLogSchema.EnvelopeRootField);
    }

    [Theory]
    [InlineData("""{"value":1,"value":1}""")]
    [InlineData("""{"value":{"a":1,"b":2,"a":3}}""")]
    [InlineData("""{"value":[{"x":[{"a":1,"a":1}]}]}""")]
    public void RepeatedPayloadKey_IsRejectedAsThePayload(string payload)
    {
        EnvelopeJson.AssertInvalid(EnvelopeJson.Payload(payload), EnvelopeFields.Payload);
    }

    [Fact]
    public void RepeatedPayloadKey_WrittenWithAnEscape_IsRejected_WithoutItsName()
    {
        var payload = $$"""{"{{Canary}}":1,"{{EnvelopeJson.UnicodeEscape('C')}}{{Canary[1..]}}":2}""";

        var parsed = EnvelopeJson.Parse(EnvelopeJson.Payload(payload));

        Assert.True(parsed.IsFailure);
        Assert.Equal(EnvelopeFields.Payload, parsed.Error.Field);
        Assert.DoesNotContain(Canary, parsed.ToString(), StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("25.0", 25)]
    [InlineData("2.5e1", 25)]
    [InlineData("1e0", 1)]
    [InlineData("1.0E+1", 10)]
    [InlineData("9007199254740991", LargestSafeInteger)]
    public void Integer_IsReadByValue(string rawBatch, long expected)
    {
        Assert.Equal(expected, EnvelopeJson.ParseValid(EnvelopeJson.With(EnvelopeFields.Batch, rawBatch)).Batch);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-0")]
    [InlineData("-1")]
    [InlineData("1.5")]
    [InlineData("1e400")]
    [InlineData("-1e400")]
    [InlineData("9007199254740992")]
    [InlineData("\"1\"")]
    [InlineData("true")]
    [InlineData("null")]
    public void Integer_OutsideTheSafePositiveRange_IsRejected(string rawValue)
    {
        foreach (var field in new[] { EnvelopeFields.Batch, EnvelopeFields.Sequence, EnvelopeFields.SchemaVersion })
        {
            EnvelopeJson.AssertInvalid(EnvelopeJson.With(field, rawValue), field);
        }
    }

    [Fact]
    public void Numbers_DoNotDependOnTheCulture()
    {
        var previous = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("pt-BR");

            Assert.Equal(25, EnvelopeJson.ParseValid(EnvelopeJson.With(EnvelopeFields.Batch, "2.5e1")).Batch);
            EnvelopeJson.AssertInvalid(EnvelopeJson.With(EnvelopeFields.Batch, "1.5"), EnvelopeFields.Batch);
        }
        finally
        {
            CultureInfo.CurrentCulture = previous;
        }
    }

    [Theory]
    [InlineData("""{"value":1e400}""")]
    [InlineData("""{"value":[-1e400]}""")]
    public void NonFiniteNumberInThePayload_IsRejected(string payload)
    {
        EnvelopeJson.AssertInvalid(EnvelopeJson.Payload(payload), EnvelopeFields.Payload);
    }

    [Theory]
    [InlineData(EventLogSchema.MaxEventTypeLength, true)]
    [InlineData(EventLogSchema.MaxEventTypeLength + 1, false)]
    [InlineData(1, true)]
    [InlineData(0, false)]
    public void TypeLength_IsInUtf16CodeUnits(int length, bool accepted)
    {
        AssertType(new string('a', length), accepted);
    }

    [Theory]
    [InlineData(EventLogSchema.MaxEventTypeLength - 2, true)]
    [InlineData(EventLogSchema.MaxEventTypeLength - 1, false)]
    public void SurrogatePairInType_CountsTwo(int letters, bool accepted)
    {
        AssertType(new string('a', letters) + GrinningFace, accepted);
    }

    [Fact]
    public void LoneSurrogateInType_IsReadWithoutThrowing()
    {
        var envelope = EnvelopeJson.ParseValid(
            EnvelopeJson.With(EnvelopeFields.Type, EnvelopeJson.Quote(EnvelopeJson.UnicodeEscape(HighSurrogate))));

        Assert.Equal(((char)HighSurrogate).ToString(), envelope.Type);
    }

    [Theory]
    [InlineData(HighSurrogate)]
    [InlineData(LowSurrogate)]
    public void LoneSurrogateInAUuid_IsRejectedWithoutThrowing(int codeUnit)
    {
        var uuid = EnvelopeJson.Court[..^1] + EnvelopeJson.UnicodeEscape(codeUnit);

        EnvelopeJson.AssertInvalid(EnvelopeJson.With(EnvelopeFields.CourtSessionId, EnvelopeJson.Quote(uuid)), EnvelopeFields.CourtSessionId);
    }

    public static TheoryData<string> InvalidUuids => new(
        EnvelopeJson.Court + EnvelopeJson.Backslash + "n",
        EnvelopeJson.Court.ToUpperInvariant(),
        EnvelopeJson.Court[..^1],
        EnvelopeJson.Court + "0",
        EnvelopeJson.Court.Replace('-', '0'),
        "c0000000-0000-4000-8000_000000000001",
        "g0000000-0000-4000-8000-000000000001",
        string.Empty);

    [Theory]
    [MemberData(nameof(InvalidUuids))]
    public void Uuid_OutsideTheLowercaseLayout_IsRejected(string rawText)
    {
        foreach (var field in new[] { EnvelopeFields.EventId, EnvelopeFields.CourtSessionId, EnvelopeFields.DeviceId })
        {
            EnvelopeJson.AssertInvalid(EnvelopeJson.With(field, EnvelopeJson.Quote(rawText)), field);
        }
    }

    [Theory]
    [InlineData("[]")]
    [InlineData("\"x\"")]
    [InlineData("1")]
    [InlineData("null")]
    [InlineData("true")]
    public void PayloadThatIsNotAnObject_IsRejected(string payload)
    {
        EnvelopeJson.AssertInvalid(EnvelopeJson.Payload(payload), EnvelopeFields.Payload);
    }

    [Fact]
    public void MissingField_IsReportedInSchemaOrder()
    {
        foreach (var field in EnvelopeFields.All)
        {
            EnvelopeJson.AssertInvalid(EnvelopeJson.Without(field), field);
        }
    }

    [Theory]
    [InlineData(EventLogSchema.MaxPayloadDepth, true)]
    [InlineData(EventLogSchema.MaxPayloadDepth + 1, false)]
    public void PayloadDepth_IsLimited_InJson(int levels, bool accepted)
    {
        AssertPayload(Nested(levels), accepted);
    }

    [Theory]
    [InlineData(EventLogSchema.MaxPayloadDepth, true)]
    [InlineData(EventLogSchema.MaxPayloadDepth + 1, false)]
    public void PayloadDepth_IsLimited_InATreeBuiltInCode(int levels, bool accepted)
    {
        RawObject payload = RawObject.Empty;
        for (var level = 1; level < levels; level++)
        {
            payload = new RawObject([new RawMember("inner", payload)]);
        }

        Assert.Equal(accepted, PayloadCopier.Copy(payload) is not null);
    }

    [Theory]
    [InlineData(EventLogSchema.MaxPayloadNodes - NodesAroundAList, true)]
    [InlineData(EventLogSchema.MaxPayloadNodes - NodesAroundAList + 1, false)]
    [InlineData(ItemsOverTheBudget, false)]
    public void PayloadNodes_AreCountedUpToTheExactLimit(int items, bool accepted)
    {
        var list = "[" + string.Join(",", Enumerable.Repeat("0", items)) + "]";

        AssertPayload($$"""{"value":{{list}}}""", accepted);
    }

    [Theory]
    [InlineData(EventLogSchema.MaxPayloadNodes - NodesAroundAList, true)]
    [InlineData(EventLogSchema.MaxPayloadNodes - NodesAroundAList + 1, false)]
    public void PayloadNodes_CountObjectMembers(int members, bool accepted)
    {
        var record = new RawObject([.. Enumerable.Range(0, members)
            .Select(index => new RawMember(index.ToString(CultureInfo.InvariantCulture), RawNull.Instance))]);

        Assert.Equal(accepted, PayloadCopier.Copy(EnvelopeJson.ValuePayload(record)) is not null);
    }

    [Fact]
    public void PayloadCopy_SortsKeysByUtf16CodeUnit_AtEveryLevel()
    {
        var envelope = EnvelopeJson.ParseValid(EnvelopeJson.Payload("""{"b":1,"a":{"d":1,"B":[{"z":1,"y":2}],"c":2}}"""));

        Assert.Equal("""{"a":{"B":[{"y":2,"z":1}],"c":2,"d":1},"b":1}""", Write(envelope.Payload));
    }

    /// <summary>JavaScript lists integer-like keys first; the parser sorts them as text, which only the fixture sees.</summary>
    [Fact]
    public void PayloadCopy_SortsIntegerLikeKeysAsText()
    {
        var envelope = EnvelopeJson.ParseValid(EnvelopeJson.Payload("""{"value":{"10":1,"9":2,"a":3}}"""));

        Assert.Equal("""{"value":{"10":1,"9":2,"a":3}}""", Write(envelope.Payload));
    }

    [Fact]
    public void ProtoKeyInThePayload_StaysAPlainKey()
    {
        var envelope = EnvelopeJson.ParseValid(
            EnvelopeJson.Payload("""{"__proto__":{"polluted":true},"nested":[{"__proto__":{"polluted":true}}]}"""));

        Assert.Equal(["__proto__", "nested"], envelope.Payload.Members.Select(member => member.Key));
    }

    public static TheoryData<string, string> CanaryInEachField => new()
    {
        { EnvelopeFields.EventId, EnvelopeJson.Quote(Canary) },
        { EnvelopeFields.CourtSessionId, EnvelopeJson.Quote(Canary) },
        { EnvelopeFields.DeviceId, EnvelopeJson.Quote(Canary) },
        { EnvelopeFields.Batch, EnvelopeJson.Quote(Canary) },
        { EnvelopeFields.Sequence, EnvelopeJson.Quote(Canary) },
        { EnvelopeFields.SchemaVersion, EnvelopeJson.Quote(Canary) },
        { EnvelopeFields.Type, EnvelopeJson.Quote(string.Concat(Enumerable.Repeat(Canary, 3))) },
        { EnvelopeFields.Payload, EnvelopeJson.Quote(Canary) },
    };

    [Theory]
    [MemberData(nameof(CanaryInEachField))]
    public void ParserError_NeverCarriesTheReceivedValue(string field, string rawValue)
    {
        var parsed = EnvelopeJson.Parse(EnvelopeJson.With(field, rawValue));

        Assert.True(parsed.IsFailure);
        Assert.Equal(field, parsed.Error.Field);
        Assert.DoesNotContain(Canary, parsed.ToString(), StringComparison.Ordinal);
    }

    internal static string Write(RawValue value)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            OrderedJsonAssert.WriteRaw(writer, value);
        }

        return System.Text.Encoding.UTF8.GetString(stream.ToArray());
    }

    private static string Nested(int levels)
    {
        var json = "{}";
        for (var level = 1; level < levels; level++)
        {
            json = $$"""{"inner":{{json}}}""";
        }

        return json;
    }

    private static void AssertType(string type, bool accepted)
    {
        var parsed = EnvelopeJson.Parse(EnvelopeJson.With(EnvelopeFields.Type, EnvelopeJson.Quote(type)));

        Assert.Equal(accepted, parsed.IsSuccess);
        if (!accepted)
        {
            Assert.Equal(EnvelopeFields.Type, parsed.Error.Field);
        }
    }

    private static void AssertPayload(string payload, bool accepted)
    {
        var parsed = EnvelopeJson.Parse(EnvelopeJson.Payload(payload));

        Assert.Equal(accepted, parsed.IsSuccess);
        if (!accepted)
        {
            Assert.Equal(EnvelopeFields.Payload, parsed.Error.Field);
        }
    }
}
