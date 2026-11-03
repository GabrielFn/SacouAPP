using System.Globalization;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.EventLog;

/// <summary>Builds envelopes as JSON text, field by field, so a test can change one raw value.</summary>
internal static class EnvelopeJson
{
    public const string Court = "c0000000-0000-4000-8000-000000000001";
    public const string Device = "d0000000-0000-4000-8000-000000000001";

    /// <summary>A JSON escape built from parts: a tool that writes files may turn the literal into the character.</summary>
    public static readonly string Backslash = @"\";

    public static string UnicodeEscape(int codeUnit) =>
        Backslash + "u" + codeUnit.ToString("x4", CultureInfo.InvariantCulture);

    public static string EventId(long number) =>
        $"e0000000-0000-4000-8000-{number.ToString("D12", CultureInfo.InvariantCulture)}";

    public static IReadOnlyList<(string Key, string Value)> ValidFields(long number = 1) =>
    [
        (EnvelopeFields.EventId, Quote(EventId(number))),
        (EnvelopeFields.CourtSessionId, Quote(Court)),
        (EnvelopeFields.DeviceId, Quote(Device)),
        (EnvelopeFields.Batch, "1"),
        (EnvelopeFields.Sequence, number.ToString(CultureInfo.InvariantCulture)),
        (EnvelopeFields.SchemaVersion, "1"),
        (EnvelopeFields.Type, Quote(AppendFixture.FixtureAppended)),
        (EnvelopeFields.Payload, """{"value":"a"}"""),
    ];

    public static string Valid(long number = 1) => Object(ValidFields(number));

    /// <summary>The valid envelope with one raw value replaced.</summary>
    public static string With(string field, string rawValue) =>
        Object([.. ValidFields().Select(member => member.Key == field ? (member.Key, rawValue) : member)]);

    public static string Without(string field) =>
        Object([.. ValidFields().Where(member => member.Key != field)]);

    /// <summary>The key goes in raw, so it may hold an escape.</summary>
    public static string WithExtra(string rawKey, string rawValue) =>
        Object([.. ValidFields(), (rawKey, rawValue)]);

    public static string Payload(string rawPayload) => With(EnvelopeFields.Payload, rawPayload);

    public static string Quote(string text) => $"\"{text}\"";

    public static string Object(IEnumerable<(string Key, string Value)> members) =>
        "{" + string.Join(",", members.Select(member => $"{Quote(member.Key)}:{member.Value}")) + "}";

    public static Result<EventEnvelope, EnvelopeError> Parse(string json) => EnvelopeParser.Parse(RawValueReader.Parse(json));

    public static EventEnvelope ParseValid(string json)
    {
        var parsed = Parse(json);
        Assert.True(parsed.IsSuccess, $"Expected a valid envelope, got {parsed}.");
        return parsed.Value;
    }

    public static void AssertInvalid(string json, string field)
    {
        var parsed = Parse(json);

        Assert.True(parsed.IsFailure, "Expected an invalid envelope.");
        Assert.Equal(EnvelopeError.InvalidEnvelopeCode, parsed.Error.Code);
        Assert.Equal(field, parsed.Error.Field);
    }

    /// <summary>An envelope built by hand, skipping the parser, as the TypeScript tests do.</summary>
    public static EventEnvelope Event(long number, RawObject? payload = null) =>
        new(
            EventId(number),
            Court,
            Device,
            Batch: 1,
            Sequence: number,
            SchemaVersion: EventLogSchema.CurrentEventSchemaVersion,
            AppendFixture.FixtureAppended,
            payload ?? ValuePayload(new RawNumber(number)));

    public static EventEnvelope Revert(long number, long target) =>
        Event(number, new RawObject([new RawMember(EventLogSchema.RevertTargetField, new RawString(EventId(target)))]))
            with
        { Type = EventLogSchema.RevertedToEventType };

    public static RawObject ValuePayload(RawValue value) => new([new RawMember(AppendFixture.ValueField, value)]);
}
