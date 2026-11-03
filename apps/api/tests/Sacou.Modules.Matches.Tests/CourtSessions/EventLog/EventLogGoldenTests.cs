using System.Collections.Immutable;
using System.Text.Json;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.EventLog;

/// <summary>Port of <c>event-log.golden.test.ts</c>, reading the same file (ADR 0025).</summary>
public sealed class EventLogGoldenTests
{
    private const int GoldenCaseCount = 132;

    private static readonly string[] GoldenIds =
    [
        "empty-log-returns-initial-state",
        "empty-log-keeps-a-seeded-initial-state",
        "acceptance-reverted-to-in-the-middle",
        "acceptance-reverted-to-in-the-middle-arriving-scrambled",
        "order-batch-beats-sequence",
        "order-sequence-by-value-not-text",
        "order-batch-by-value-not-text",
        "order-tie-broken-by-device",
        "order-device-beats-event-id",
        "order-gap-in-sequence-is-accepted",
        "order-late-event-of-a-lower-batch-enters-first",
        "order-limits-accepted-at-the-largest-integer",
        "duplicate-resent-once-adjacent",
        "duplicate-resent-three-times",
        "duplicate-resent-from-a-distance",
        "duplicate-with-payload-keys-in-another-order",
        "duplicate-of-an-inactive-event-stays-inactive",
        "conflict-payload-differs",
        "conflict-payload-differs-other-arrival",
        "conflict-array-order-matters",
        "conflict-payload-with-extra-key",
        "conflict-batch-differs",
        "conflict-batch-differs-other-arrival",
        "conflict-type-differs",
        "conflict-in-an-inactive-event",
        "sequence-conflict-same-order-key-other-event-id",
        "sequence-conflict-other-arrival",
        "version-unknown-at-the-start",
        "version-unknown-at-the-end",
        "version-999",
        "version-unknown-in-an-inactive-event",
        "version-two-unknown-reports-the-first-canonical",
        "version-zero",
        "version-fractional",
        "version-as-text",
        "revert-to-the-previous-event",
        "revert-and-keep-playing",
        "revert-twice-in-a-row",
        "revert-to-the-last-active-has-no-effect",
        "revert-arriving-before-its-target",
        "revert-resent",
        "revert-to-a-new-event-after-an-earlier-revert",
        "revert-target-missing",
        "revert-with-no-events-before",
        "revert-target-in-the-future",
        "revert-target-is-itself",
        "revert-target-inactive",
        "revert-target-inactive-after-playing-on",
        "revert-target-is-another-revert",
        "revert-payload-empty",
        "revert-payload-target-not-text",
        "revert-payload-with-extra-field",
        "revert-payload-wrong-field",
        "stream-mismatch",
        "unknown-type",
        "unknown-type-constructor",
        "unknown-type-proto",
        "unknown-type-to-string",
        "event-rejected-leaves-no-partial-state",
        "event-rejected-by-a-malformed-payload",
        "precedence-stream-mismatch-beats-id-conflict",
        "precedence-id-conflict-beats-sequence-conflict",
        "precedence-id-conflict-beats-version",
        "precedence-sequence-conflict-beats-version",
        "precedence-version-beats-unknown-type",
        "precedence-fold-stops-at-the-first-canonical-failure",
        "precedence-conflict-reported-at-the-first-canonical-position",
        "envelope-missing-eventId",
        "envelope-missing-courtSessionId",
        "envelope-missing-deviceId",
        "envelope-missing-batch",
        "envelope-missing-sequence",
        "envelope-missing-schemaVersion",
        "envelope-missing-type",
        "envelope-missing-payload",
        "envelope-extra-field",
        "envelope-forbidden-field-email",
        "envelope-forbidden-field-name",
        "envelope-forbidden-field-nickname",
        "envelope-forbidden-field-phone",
        "envelope-forbidden-field-pix",
        "envelope-forbidden-field-photo",
        "envelope-forbidden-field-userId",
        "envelope-unknown-field-wins-over-an-invalid-field",
        "envelope-fields-checked-in-schema-order",
        "envelope-eventId-uppercase",
        "envelope-eventId-not-a-uuid",
        "envelope-eventId-trailing-line-break",
        "envelope-eventId-not-text",
        "envelope-courtSessionId-uppercase",
        "envelope-courtSessionId-not-a-uuid",
        "envelope-courtSessionId-trailing-line-break",
        "envelope-courtSessionId-not-text",
        "envelope-deviceId-uppercase",
        "envelope-deviceId-not-a-uuid",
        "envelope-deviceId-trailing-line-break",
        "envelope-deviceId-not-text",
        "envelope-device-id-hardware-text",
        "envelope-device-id-email",
        "envelope-batch-zero",
        "envelope-batch-negative",
        "envelope-batch-fractional",
        "envelope-batch-above-the-limit",
        "envelope-batch-as-text",
        "envelope-sequence-zero",
        "envelope-sequence-negative",
        "envelope-sequence-fractional",
        "envelope-sequence-above-the-limit",
        "envelope-sequence-as-text",
        "envelope-type-empty",
        "envelope-type-too-long",
        "envelope-type-not-text",
        "envelope-type-at-the-limit-reaches-the-replay",
        "envelope-payload-array",
        "envelope-payload-text",
        "envelope-payload-number",
        "envelope-payload-null",
        "envelope-not-an-object",
        "envelope-null",
        "envelope-array",
        "payload-32-levels-is-accepted",
        "payload-33-levels-is-rejected",
        "payload-4096-nodes-is-accepted",
        "payload-4097-nodes-is-rejected",
        "payload-value-null-is-a-value",
        "payload-proto-key-is-a-plain-key",
        "payload-proto-key-reaches-the-state-as-a-plain-key",
        "payload-proto-key-is-not-a-missing-key",
        "key-order-resend-gives-sorted-keys",
        "key-order-resend-gives-sorted-keys-other-arrival",
        "key-order-sorted-at-every-level",
        "key-order-by-code-unit-not-locale",
    ];

    private static readonly string[] ForbiddenNames = ["email", "name", "nickname", "phone", "pix", "photo", "userId"];

    private static readonly HashSet<string> CaseFields = ["id", "courtSessionId", "initialState", "events", "expected"];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("event-log.json");

    public static TheoryData<string> CaseIds => new(GoldenIds);

    [Fact]
    public void GoldenList_HasTheExactTotal()
    {
        Assert.Equal(GoldenCaseCount, GoldenIds.Length);
    }

    [Fact]
    public void GoldenList_MatchesTheFile()
    {
        GoldenFile.AssertListMatchesFile(GoldenIds, [.. Cases.Select(GoldenFile.IdOf)]);
    }

    [Theory]
    [MemberData(nameof(CaseIds))]
    public void Replay_MatchesTheGoldenCase(string id)
    {
        var goldenCase = GoldenFile.SingleCase(Cases, GoldenFile.IdOf, id);
        GoldenFile.AssertOnlyFields(goldenCase, CaseFields, id);

        var config = AppendFixture.Config(
            GoldenFile.Text(goldenCase, "courtSessionId"),
            InitialStateOf(goldenCase.GetProperty("initialState")));
        var outcome = EventLogPipeline.Run(config, RawEventsOf(goldenCase));

        OrderedJsonAssert.Equal(goldenCase.GetProperty("expected"), writer => EventLogPipeline.Write(writer, outcome), id);
    }

    /// <summary>Like <c>replay-timeline.test.ts</c>: the timeline rebuilds what ReplayEvents returns.</summary>
    [Theory]
    [MemberData(nameof(CaseIds))]
    public void Timeline_RebuildsReplayEvents(string id)
    {
        var goldenCase = GoldenFile.SingleCase(Cases, GoldenFile.IdOf, id);
        var parsed = RawEventsOf(goldenCase).Select(rawEvent => EnvelopeParser.Parse(RawValueReader.Parse(rawEvent))).ToList();
        if (parsed.Any(envelope => envelope.IsFailure))
        {
            return;
        }

        var config = AppendFixture.Config(
            GoldenFile.Text(goldenCase, "courtSessionId"),
            InitialStateOf(goldenCase.GetProperty("initialState")));
        var envelopes = parsed.Select(envelope => envelope.Value).ToList();

        var replayed = EventReplayer.ReplayEvents(config, envelopes);
        var timeline = EventReplayer.ReplayTimeline(config, envelopes);

        Assert.Equal(replayed.IsSuccess, timeline.IsSuccess);
        if (replayed.IsFailure)
        {
            Assert.Equal(replayed.Error, timeline.Error);
            return;
        }

        var entries = timeline.Value.Entries;
        Assert.Equal(replayed.Value.ActiveEventIds, entries.Select(entry => entry.Event.EventId));
        Assert.Equal(AppendFixture.Text(entries.IsEmpty ? config.InitialState : entries[^1].State), AppendFixture.Text(replayed.Value.State));
    }

    [Fact]
    public void EveryReplayErrorCode_HasACase()
    {
        var codes = Cases
            .Select(goldenCase => goldenCase.GetProperty("expected"))
            .Where(expected => !expected.GetProperty("ok").GetBoolean())
            .Select(expected => GoldenFile.Text(expected, "code"))
            .ToHashSet();

        Assert.All(ReplayErrorCode.All, code => Assert.Contains(code.Code, codes));
    }

    [Fact]
    public void EveryForbiddenNameAndMissingField_HasACase()
    {
        var ids = GoldenIds.ToHashSet();

        Assert.All(ForbiddenNames, name => Assert.Contains($"envelope-forbidden-field-{name}", ids));
        Assert.All(EnvelopeFields.All, field => Assert.Contains($"envelope-missing-{field}", ids));
    }

    internal static ImmutableArray<string> RawEventsOf(JsonElement goldenCase) =>
        [.. goldenCase.GetProperty("events").EnumerateArray().Select(rawEvent => rawEvent.GetRawText())];

    /// <summary>Read like an event, through the production reader, so the state holds the same values.</summary>
    private static FixtureState InitialStateOf(JsonElement initialState)
    {
        var raw = Assert.IsType<RawObject>(RawValueReader.Parse(initialState.GetRawText()));
        Assert.True(raw.TryGetMember("values", out var values), "initialState: missing values.");
        return new FixtureState(Assert.IsType<RawArray>(values).Items);
    }
}

/// <summary>The outcome of a golden case: the first parser error, else the replay result.</summary>
internal sealed record EventLogOutcome(
    EnvelopeError? EnvelopeError,
    Result<ReplayedState<FixtureState>, ReplayError>? Replay);

internal static class EventLogPipeline
{
    /// <summary>Like <c>runCase</c> in the TypeScript test: each raw event is parsed in order, and the first error wins.</summary>
    public static EventLogOutcome Run(ReplayConfig<FixtureState> config, IEnumerable<string> rawEvents)
    {
        var parsed = ImmutableArray.CreateBuilder<EventEnvelope>();
        foreach (var rawEvent in rawEvents)
        {
            var envelope = EnvelopeParser.Parse(RawValueReader.Parse(rawEvent));
            if (envelope.IsFailure)
            {
                return new EventLogOutcome(envelope.Error, null);
            }

            parsed.Add(envelope.Value);
        }

        return new EventLogOutcome(null, EventReplayer.ReplayEvents(config, parsed));
    }

    /// <summary>The same keys, in the same order, as <c>{ ok, ...value }</c> and <c>{ ok, ...error }</c> in TypeScript.</summary>
    public static void Write(Utf8JsonWriter writer, EventLogOutcome outcome)
    {
        writer.WriteStartObject();
        if (outcome.EnvelopeError is { } envelopeError)
        {
            writer.WriteBoolean("ok", false);
            writer.WriteString("code", envelopeError.Code);
            writer.WriteString("field", envelopeError.Field);
        }
        else if (outcome.Replay is { IsFailure: true } failure)
        {
            writer.WriteBoolean("ok", false);
            writer.WriteString("code", failure.Error.Code.Code);
            writer.WriteString("eventId", failure.Error.EventId);
        }
        else
        {
            var replayed = outcome.Replay!.Value;
            writer.WriteBoolean("ok", true);
            writer.WritePropertyName("state");
            writer.WriteStartObject();
            writer.WritePropertyName("values");
            OrderedJsonAssert.WriteRaw(writer, new RawArray(replayed.State.Values));
            writer.WriteEndObject();
            writer.WriteStartArray("activeEventIds");
            foreach (var eventId in replayed.ActiveEventIds)
            {
                writer.WriteStringValue(eventId);
            }

            writer.WriteEndArray();
        }

        writer.WriteEndObject();
    }
}
