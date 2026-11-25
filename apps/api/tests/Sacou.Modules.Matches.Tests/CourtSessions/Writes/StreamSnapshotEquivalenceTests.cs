using System.Collections.Concurrent;
using System.Collections.Immutable;
using System.Text;
using System.Text.Json;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.Appliers;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;
using Sacou.Modules.Matches.Tests.CourtSessions.EventLog;
using Sacou.Modules.Matches.Tests.CourtSessions.Score;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Writes;

/// <summary>
/// The golden of ADR 0081: over every log of the event golden files and of <c>server-checks.json</c>, at every cut, the
/// replay continued from the stored part has the outcome of the replay of the whole log (state, active events, error,
/// tracked steps and the timeline right before each), and the snapshot built in two parts is the one built at once,
/// with the counts the ceilings had before the snapshot. The motor and its golden do not change: TypeScript has no
/// snapshot, so these run the shared golden through both C# paths.
/// </summary>
public sealed class StreamSnapshotEquivalenceTests
{
    private static readonly string[] ScoreGoldenFiles =
    [
        "score-events.json",
        "rotation-events.json",
        "queue-events.json",
        "attributions-events.json",
        "corrections-events.json",
        "bench-events.json",
        "libero-events.json",
        "stats-events.json",
        "round-summary.json",
    ];

    private const string EventLogFile = "event-log.json";
    private const string ServerChecksFile = "server-checks.json";

    private static readonly string InitialStateText = CourtSessionStateWriter.ToJson(CourtSessionState.Initial);

    private static readonly ConcurrentDictionary<string, IReadOnlyList<JsonElement>> Files = new(StringComparer.Ordinal);

    public static TheoryData<string, string> ScoreCases
    {
        get
        {
            var cases = new TheoryData<string, string>();
            foreach (var file in ScoreGoldenFiles)
            {
                foreach (var goldenCase in GoldenFile.ReadEmbeddedCases(file))
                {
                    cases.Add(file, GoldenFile.IdOf(goldenCase));
                }
            }

            return cases;
        }
    }

    public static TheoryData<string> EventLogCases => new(GoldenFile.ReadEmbeddedCases(EventLogFile).Select(GoldenFile.IdOf));

    public static TheoryData<string> ServerCheckCases => new(GoldenFile.ReadEmbeddedCases(ServerChecksFile).Select(GoldenFile.IdOf));

    [Theory]
    [MemberData(nameof(ScoreCases))]
    public void ScoreLog_ContinuedAtEveryCut_IsTheWholeReplay(string file, string id)
    {
        var goldenCase = GoldenFile.SingleCase(CasesOf(file), GoldenFile.IdOf, id);
        if (ParsedEvents(goldenCase) is not { } parsed)
        {
            return;
        }

        var config = ScoreAppliers.Config(
            GoldenFile.Text(goldenCase, "courtSessionId"),
            CourtSessionStateReader.Read(goldenCase.GetProperty("initialState")));
        AssertEveryCut(config, [.. parsed.Select(item => item.Envelope)], CourtSessionStateWriter.ToJson);
        // A stored stream starts empty and its ids are unique, which the database enforces.
        var storable = CourtSessionStateWriter.ToJson(config.InitialState) == InitialStateText
            && parsed.Select(item => item.Envelope.EventId).Distinct(StringComparer.Ordinal).Count() == parsed.Length;
        if (storable)
        {
            AssertSnapshotsAtEveryCut(config.CourtSessionId, parsed);
        }
    }

    [Theory]
    [MemberData(nameof(EventLogCases))]
    public void EventLog_ContinuedAtEveryCut_IsTheWholeReplay(string id)
    {
        var goldenCase = GoldenFile.SingleCase(CasesOf(EventLogFile), GoldenFile.IdOf, id);
        if (ParsedEvents(goldenCase) is not { } parsed)
        {
            return;
        }

        var config = AppendFixture.Config(
            GoldenFile.Text(goldenCase, "courtSessionId"),
            EventLogGoldenTests.InitialStateOf(goldenCase.GetProperty("initialState")));
        AssertEveryCut(config, [.. parsed.Select(item => item.Envelope)], AppendFixture.Text);
    }

    [Theory]
    [MemberData(nameof(ServerCheckCases))]
    public void ServerCheck_ContinuedAtEveryCut_IsTheWholeReplay(string id)
    {
        var events = ServerChecksGoldenTests.EventsOf(GoldenFile.SingleCase(CasesOf(ServerChecksFile), GoldenFile.IdOf, id));
        var courtSessionId = events[0].Envelope.CourtSessionId;

        AssertEveryCut(ScoreAppliers.Config(courtSessionId), [.. events.Select(item => item.Envelope)], CourtSessionStateWriter.ToJson);
        AssertSnapshotsAtEveryCut(courtSessionId, events);
    }

    /// <summary>The test proves something only if the continued path runs: most cuts of logs in order take it.</summary>
    [Fact]
    public void TheContinuedPath_IsTakenByMostCutsOfTheServerChecks()
    {
        var cuts = GoldenFile.ReadEmbeddedCases(ServerChecksFile)
            .Select(ServerChecksGoldenTests.EventsOf)
            .SelectMany(events => Enumerable.Range(0, events.Length + 1).Select(cut => (events, cut)))
            .ToList();
        var continued = cuts.Count(item =>
        {
            var snapshot = StreamSnapshot.Empty.Advance(item.events[0].Envelope.CourtSessionId, item.events[..item.cut]);
            return snapshot.Continues(item.events[0].Envelope.CourtSessionId, [.. item.events[item.cut..].Select(stored => stored.Envelope)]);
        });

        Assert.True(continued * 2 > cuts.Count, $"{continued} of {cuts.Count}");
    }

    private static IReadOnlyList<JsonElement> CasesOf(string file) => Files.GetOrAdd(file, GoldenFile.ReadEmbeddedCases);

    /// <summary>Null when an envelope does not parse: the parser's golden, never the replay's.</summary>
    private static ImmutableArray<StreamEvent>? ParsedEvents(JsonElement goldenCase)
    {
        var raws = EventLogGoldenTests.RawEventsOf(goldenCase);
        var parsed = raws.Select(raw => EnvelopeParser.Parse(RawValueReader.Parse(raw))).ToList();
        return parsed.Any(envelope => envelope.IsFailure)
            ? null
            : [.. parsed.Select((envelope, index) => new StreamEvent(envelope.Value, Encoding.UTF8.GetByteCount(raws[index])))];
    }

    private static void AssertEveryCut<TState>(ReplayConfig<TState> config, ImmutableArray<EventEnvelope> events, Func<TState, string> text)
        where TState : notnull
    {
        for (var cut = 0; cut <= events.Length; cut++)
        {
            var stored = events[..cut];
            var newIds = events[cut..].Select(envelope => envelope.EventId).ToHashSet(StringComparer.Ordinal);
            bool IsNew(EventEnvelope envelope) => newIds.Contains(envelope.EventId);
            var storedReplay = EventReplayer.ReplaySteps(config, stored, _ => false);
            var checkpoint = new Checkpoint<TState>(storedReplay.IsSuccess ? storedReplay.Value.Head : null, stored);

            var whole = EventReplayer.ReplaySteps(config, events, IsNew);
            var continued = EventReplayer.ContinueSteps(config, checkpoint, events[cut..], IsNew);

            AssertSame(config, whole, continued, text, $"cut {cut}");
        }
    }

    private static void AssertSame<TState>(
        ReplayConfig<TState> config,
        Result<ReplayedSteps<TState>, ReplayError> whole,
        Result<ReplayedSteps<TState>, ReplayError> continued,
        Func<TState, string> text,
        string at)
        where TState : notnull
    {
        Assert.True(whole.IsSuccess == continued.IsSuccess, at);
        if (whole.IsFailure)
        {
            Assert.Equal(whole.Error, continued.Error);
            return;
        }

        Assert.Equal(TimelineText(config, whole.Value.Head, text), TimelineText(config, continued.Value.Head, text));
        Assert.Equal(whole.Value.Steps.Select(StepKey), continued.Value.Steps.Select(StepKey));
        if (!whole.Value.Steps.IsEmpty)
        {
            // The first step meets the stored part, the one place the two paths differ; the rest replay the same events.
            Assert.Equal(TimelineText(config, whole.Value.Steps[0].Before, text), TimelineText(config, continued.Value.Steps[0].Before, text));
        }
    }

    /// <summary>Each tracked event with the active event right before it: cheap enough for every step of every cut.</summary>
    private static (string EventId, string? Before) StepKey<TState>(ReplayStep<TState> step)
        where TState : notnull =>
        (step.Event.EventId, step.Before.LastEvent?.EventId);

    /// <summary>The active events and the state at the head: what a timeline holds, for comparing two.</summary>
    private static string TimelineText<TState>(ReplayConfig<TState> config, Timeline<TState> timeline, Func<TState, string> text)
        where TState : notnull =>
        $"{string.Join(',', timeline.ToEntries().Select(entry => entry.Event.EventId))}|{text(timeline.StateOr(config.InitialState))}";

    /// <summary>
    /// In two parts or at once, the same snapshot; and the counts a part keeps are the ones the ceilings counted over
    /// the stored events before the snapshot, with the match of every event of the whole log.
    /// </summary>
    private static void AssertSnapshotsAtEveryCut(string courtSessionId, ImmutableArray<StreamEvent> events)
    {
        var atOnce = StreamSnapshot.Empty.Advance(courtSessionId, events);
        for (var cut = 0; cut <= events.Length; cut++)
        {
            var first = StreamSnapshot.Empty.Advance(courtSessionId, events[..cut]);
            var inTwo = first.Advance(courtSessionId, events[cut..]);
            AssertSameSnapshot(atOnce, inTwo, $"cut {cut}");
            if (first.Head is not null)
            {
                var beforeTheSnapshot = StreamLimitCheck.CountAll(
                    events[..cut], StreamLimitCheck.WithMatches(ImmutableDictionary<string, string>.Empty, events));
                Assert.Equal(beforeTheSnapshot.OrderBy(Key), first.Counts.OrderBy(Key));
            }
        }
    }

    private static string Key(KeyValuePair<StreamCounterKey, int> count) => $"{count.Key.Limit}/{count.Key.Key}";

    internal static void AssertSameSnapshot(StreamSnapshot expected, StreamSnapshot actual, string at)
    {
        Assert.True(expected.Head is null == actual.Head is null, at);
        Assert.Equal(expected.Version, actual.Version);
        Assert.Equal(expected.LastStoredEventId, actual.LastStoredEventId);
        Assert.Equal(expected.TotalBytes, actual.TotalBytes);
        Assert.Equal(expected.LastEvent?.EventId, actual.LastEvent?.EventId);
        Assert.Equal(expected.MatchByEventId.OrderBy(pair => pair.Key, StringComparer.Ordinal), actual.MatchByEventId.OrderBy(pair => pair.Key, StringComparer.Ordinal));
        foreach (var device in expected.Events.Select(item => item.Envelope.DeviceId).Distinct())
        {
            Assert.Equal(expected.LastSequenceOf(device), actual.LastSequenceOf(device));
        }

        if (expected.Head is { } head)
        {
            Assert.Equal(expected.Counts.OrderBy(Key), actual.Counts.OrderBy(Key));
            var config = ScoreAppliers.Config(string.Empty);
            Assert.Equal(TimelineText(config, head, CourtSessionStateWriter.ToJson), TimelineText(config, actual.Head!, CourtSessionStateWriter.ToJson));
        }
    }

    /// <summary>A stored log already replayed, as a store would keep it, for any state.</summary>
    private sealed class Checkpoint<TState>(Timeline<TState>? head, ImmutableArray<EventEnvelope> stored) : IReplayCheckpoint<TState>
        where TState : notnull
    {
        private readonly HashSet<string> _ids = stored.Select(envelope => envelope.EventId).ToHashSet(StringComparer.Ordinal);

        public Timeline<TState>? Head { get; } = head;

        public EventEnvelope? LastEvent { get; } = stored.IsEmpty ? null : stored.Max(CanonicalOrder.Instance);

        public IEnumerable<EventEnvelope> StoredEvents => stored;

        public bool IsStored(string eventId) => _ids.Contains(eventId);
    }
}
