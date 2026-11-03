using System.Collections.Immutable;
using System.Text.Json;
using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.EventLog;

/// <summary>Port of <c>replay-events.test.ts</c> and <c>replay-timeline.test.ts</c>.</summary>
public sealed class EventReplayerTests
{
    private const string Canary = "CANARY-fictional.player@example.com";
    private const int PermutationsOfSix = 720;
    private const int ManyEvents = 10_000;
    private const long UnknownTarget = 9;

    private static readonly ReplayConfig<FixtureState> Config = AppendFixture.Config(EnvelopeJson.Court);

    [Fact]
    public void EveryArrivalOrder_GivesTheSameStateText()
    {
        EventEnvelope[] log =
            [Event(1), Event(2), Event(3), EnvelopeJson.Revert(4, 2), Event(5), Event(6)];
        var expected = StateText(EventReplayer.ReplayEvents(Config, log));

        var orders = Permutations(log).ToList();

        Assert.Equal(PermutationsOfSix, orders.Count);
        Assert.Equal("""{"values":[1,2,5,6],"active":[1,2,5,6]}""", expected);
        Assert.All(orders, order => Assert.Equal(expected, StateText(EventReplayer.ReplayEvents(Config, order))));
    }

    [Fact]
    public void EveryArrivalOrder_GivesTheSameError()
    {
        EventEnvelope[] failing =
        [
            Event(1),
            EnvelopeJson.Event(2, EnvelopeJson.ValuePayload(new RawString("other"))),
            Event(2),
            EnvelopeJson.Event(3, RawObject.Empty),
            EnvelopeJson.Revert(4, UnknownTarget),
        ];

        Assert.All(Permutations(failing), order =>
        {
            var replayed = EventReplayer.ReplayEvents(Config, order);
            Assert.Equal(new ReplayError(ReplayErrorCode.EventIdConflict, EnvelopeJson.EventId(2)), replayed.Error);
        });
    }

    [Fact]
    public void EmptyLog_ReturnsTheInitialState()
    {
        var initial = new FixtureState([new RawString("seed")]);

        var replayed = EventReplayer.ReplayEvents(AppendFixture.Config(EnvelopeJson.Court, initial), []);

        Assert.Same(initial, replayed.Value.State);
        Assert.Empty(replayed.Value.ActiveEventIds);
    }

    /// <summary>Parsed envelopes hold lowercase UUIDs only, so this skips the parser, as the TypeScript test does.</summary>
    [Fact]
    public void CanonicalOrder_ComparesTextByUtf16CodeUnit()
    {
        var upper = EnvelopeJson.Event(1, EnvelopeJson.ValuePayload(new RawString("upper"))) with { DeviceId = "B" };
        var lower = EnvelopeJson.Event(2, EnvelopeJson.ValuePayload(new RawString("lower"))) with { DeviceId = "a", Sequence = 1 };

        var replayed = EventReplayer.ReplayEvents(Config, [lower, upper]);

        Assert.Equal(["upper", "lower"], replayed.Value.State.Values.Select(value => Assert.IsType<RawString>(value).Value));
    }

    [Fact]
    public void ProtoKey_IsNotMistakenForAMissingOne()
    {
        var first = EnvelopeJson.Event(1, new RawObject([new RawMember("__proto__", RawObject.Empty)]));
        var second = EnvelopeJson.Event(1, new RawObject([new RawMember("other", RawObject.Empty)]));

        var replayed = EventReplayer.ReplayEvents(Config, [first, second]);

        Assert.Equal(new ReplayError(ReplayErrorCode.EventIdConflict, EnvelopeJson.EventId(1)), replayed.Error);
    }

    [Fact]
    public void NegativeZero_EqualsZero_InAResend()
    {
        var zero = EnvelopeJson.ParseValid(EnvelopeJson.Payload("""{"value":0}"""));
        var negativeZero = EnvelopeJson.ParseValid(EnvelopeJson.Payload("""{"value":-0}"""));

        Assert.True(EventReplayer.ReplayEvents(Config, [zero, negativeZero]).IsSuccess);
    }

    [Fact]
    public void ResendWithKeysInAnotherOrder_GivesTheSameState()
    {
        var first = EnvelopeJson.ParseValid(EnvelopeJson.Payload("""{"value":{"a":1,"b":2}}"""));
        var second = EnvelopeJson.ParseValid(EnvelopeJson.Payload("""{"value":{"b":2,"a":1}}"""));

        Assert.All(
            new[] { new[] { first, second }, [second, first] },
            order =>
            {
                var replayed = EventReplayer.ReplayEvents(Config, order);
                Assert.Equal("""{"a":1,"b":2}""", EnvelopeParserTests.Write(Assert.Single(replayed.Value.State.Values)));
            });
    }

    [Fact]
    public void ApplierRegisteredForRevertedTo_CannotTakeOverTheCore()
    {
        var hijacked = AppendFixture.Appliers.SetItem(
            EventLogSchema.RevertedToEventType,
            (_, _) => Result<FixtureState, EventRejection>.Success(new FixtureState([new RawString("hijacked")])));

        var replayed = EventReplayer.ReplayEvents(
            new ReplayConfig<FixtureState>(EnvelopeJson.Court, FixtureState.Empty, hijacked),
            [Event(1), Event(2), EnvelopeJson.Revert(3, 1)]);

        Assert.Equal([1d], Numbers(replayed.Value.State));
    }

    [Fact]
    public void AppliersAreLookedUpByCodeUnit_WhateverComparerCameIn()
    {
        var caseInsensitive = AppendFixture.Appliers.WithComparers(StringComparer.OrdinalIgnoreCase);
        var envelope = Event(1) with { Type = AppendFixture.FixtureAppended.ToUpperInvariant() };

        var replayed = EventReplayer.ReplayEvents(
            new ReplayConfig<FixtureState>(EnvelopeJson.Court, FixtureState.Empty, caseInsensitive),
            [envelope]);

        Assert.Equal(ReplayErrorCode.UnknownEventType, replayed.Error.Code);
    }

    public static TheoryData<string> ReplayErrorCodes => new(ReplayErrorCode.All.Select(code => code.Code));

    [Theory]
    [MemberData(nameof(ReplayErrorCodes))]
    public void ReplayError_NeverCarriesReceivedContent(string code)
    {
        var replayed = EventReplayer.ReplayEvents(Config, CanaryLog(code));

        Assert.Equal(code, replayed.Error.Code.Code);
        Assert.DoesNotContain(Canary, replayed.ToString(), StringComparison.Ordinal);
        Assert.DoesNotContain(Canary, replayed.Error.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public void ManyEvents_DoNotOverflowTheStack()
    {
        var replayed = EventReplayer.ReplayEvents(Config, ManyZeroEvents());

        Assert.Equal(ManyEvents, replayed.Value.ActiveEventIds.Length);
    }

    [Fact]
    public void RevertOverManyEvents_DoesNotOverflowTheStack()
    {
        var replayed = EventReplayer.ReplayEvents(Config, [.. ManyZeroEvents(), EnvelopeJson.Revert(ManyEvents + 1, 1)]);

        Assert.Equal([EnvelopeJson.EventId(1)], replayed.Value.ActiveEventIds);
    }

    [Fact]
    public void AlternatingEventsAndReverts_Complete()
    {
        var log = Enumerable.Range(1, ManyEvents)
            .Select(number => number % 2 == 1 ? ZeroEvent(number) : EnvelopeJson.Revert(number, number - 1));

        var replayed = EventReplayer.ReplayEvents(Config, log);

        Assert.True(replayed.IsSuccess);
    }

    [Fact]
    public void Timeline_KeepsTheStateRightAfterEachActiveEvent_InCanonicalOrder()
    {
        var timeline = EventReplayer.ReplayTimeline(Config, [Event(2), Event(1), Event(3)]);

        Assert.Equal(
            ["1:1", "2:1,2", "3:1,2,3"],
            timeline.Value.Entries.Select(EntryText));
    }

    [Fact]
    public void Timeline_AfterARevert_ListsOnlyTheActiveEvents_AndNeverTheRevert()
    {
        var timeline = EventReplayer.ReplayTimeline(
            Config, [Event(1), Event(2), Event(3), EnvelopeJson.Revert(4, 1), Event(5)]);

        Assert.Equal(
            ["1:1", "5:1,5"],
            timeline.Value.Entries.Select(EntryText));
    }

    [Fact]
    public void Timeline_OfAnEmptyLog_HasNoEntries()
    {
        Assert.Empty(EventReplayer.ReplayTimeline(Config, []).Value.Entries);
    }

    [Fact]
    public void Timeline_FailsLikeReplayEvents_WithoutAPartialTimeline()
    {
        EventEnvelope[] log = [Event(1), EnvelopeJson.Revert(2, UnknownTarget)];

        Assert.Equal(EventReplayer.ReplayEvents(Config, log).Error, EventReplayer.ReplayTimeline(Config, log).Error);
    }

    [Fact]
    public void Timeline_LastEntry_HoldsTheStateReplayEventsReturns()
    {
        EventEnvelope[] log = [Event(1), Event(2)];

        var last = EventReplayer.ReplayTimeline(Config, log).Value.Entries[^1];

        Assert.Equal(AppendFixture.Text(last.State), AppendFixture.Text(EventReplayer.ReplayEvents(Config, log).Value.State));
    }

    internal static string StateText(Result<ReplayedState<FixtureState>, ReplayError> replayed)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            writer.WriteStartObject();
            writer.WritePropertyName("values");
            OrderedJsonAssert.WriteRaw(writer, new RawArray(replayed.Value.State.Values));
            writer.WriteStartArray("active");
            foreach (var eventId in replayed.Value.ActiveEventIds)
            {
                writer.WriteNumberValue(long.Parse(eventId[^12..], System.Globalization.CultureInfo.InvariantCulture));
            }

            writer.WriteEndArray();
            writer.WriteEndObject();
        }

        return System.Text.Encoding.UTF8.GetString(stream.ToArray());
    }

    private static EventEnvelope Event(long number) => EnvelopeJson.Event(number);

    private static EventEnvelope ZeroEvent(long number) => EnvelopeJson.Event(number, EnvelopeJson.ValuePayload(new RawNumber(0)));

    private static ImmutableArray<EventEnvelope> ManyZeroEvents() => [.. Enumerable.Range(1, ManyEvents).Select(number => ZeroEvent(number))];

    private static RawObject CanaryPayload() => EnvelopeJson.ValuePayload(new RawString(Canary));

    private static EventEnvelope[] CanaryLog(string code) => code switch
    {
        "stream-mismatch" => [EnvelopeJson.Event(1, CanaryPayload()) with { CourtSessionId = "other" }],
        "event-id-conflict" => [EnvelopeJson.Event(1, CanaryPayload()), Event(1)],
        "sequence-conflict" => [EnvelopeJson.Event(1, CanaryPayload()), EnvelopeJson.Event(2, RawObject.Empty) with { Sequence = 1 }],
        "unsupported-schema-version" => [EnvelopeJson.Event(1, CanaryPayload()) with { SchemaVersion = 2 }],
        "unknown-event-type" => [EnvelopeJson.Event(1, RawObject.Empty) with { Type = Canary }],
        "event-rejected" => [EnvelopeJson.Event(1, CanaryPayload()) with { Type = AppendFixture.FixtureRejected }],
        "invalid-revert-target" =>
        [
            EnvelopeJson.Event(1, new RawObject([new RawMember(EventLogSchema.RevertTargetField, new RawString(Canary))]))
                with { Type = EventLogSchema.RevertedToEventType },
        ],
        _ => throw new ArgumentOutOfRangeException(nameof(code), code, "No canary log for this code."),
    };

    /// <summary>The sequence of the event and the values right after it, such as <c>2:1,2</c>.</summary>
    private static string EntryText(TimelineEntry<FixtureState> entry) =>
        $"{entry.Event.Sequence.ToString(System.Globalization.CultureInfo.InvariantCulture)}:"
        + string.Join(",", Numbers(entry.State).Select(number => number.ToString(System.Globalization.CultureInfo.InvariantCulture)));

    private static IEnumerable<double> Numbers(FixtureState state) =>
        state.Values.Select(value => Assert.IsType<RawNumber>(value).Value);

    private static IEnumerable<ImmutableArray<T>> Permutations<T>(ImmutableArray<T> items) =>
        items.Length <= 1
            ? [items]
            : items.SelectMany((item, index) => Permutations(items.RemoveAt(index)).Select(rest => rest.Insert(0, item)));

    private static IEnumerable<ImmutableArray<T>> Permutations<T>(T[] items) => Permutations(items.ToImmutableArray());
}
