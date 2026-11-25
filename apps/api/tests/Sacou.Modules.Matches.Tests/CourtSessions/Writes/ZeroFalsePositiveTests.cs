using System.Collections.Immutable;
using System.Text.Json;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;
using Sacou.Modules.Matches.Tests.CourtSessions.Score;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Writes;

/// <summary>
/// A false positive locks a court for good: the phone never syncs that stream again (ADR 0060, R1).
/// Every accepted log of the event golden files, from an empty stream, is accepted by the write rules,
/// at once and one event per request. The exclusions are written by hand, each with its reason.
/// </summary>
public sealed class ZeroFalsePositiveTests
{
    private static readonly string[] GoldenFiles =
    [
        "score-events.json",
        "rotation-events.json",
        "queue-events.json",
        "attributions-events.json",
        "corrections-events.json",
        "bench-events.json",
        "libero-events.json",
        "stats-events.json",
    ];

    private const string ShortcutSetEnd = "A SetEnded before the set is decided, written by hand to reach a state in few events; confirmSetEnd refuses it.";

    private const string AppliedAsRecorded = "Forged to show that the applier records the result as it comes; no command emits it.";

    private const string IgnoredAttribution = "An attribution the command refuses, to show that the resolver ignores it.";

    private const string NotOneWriterInOrder = "Two devices, or events out of their order, in one log: never one request of one writer.";

    private const string ResendInTheLog = "An exact resend inside the log: one request never repeats an event id.";

    private const string UnsupportedVersion = "A version outside the supported lists, to show that the replay applies the frozen copy.";

    /// <summary>Accepted logs no command emits, by file and id, each with its reason.</summary>
    private static readonly ImmutableDictionary<string, string> Exclusions = ImmutableDictionary.CreateRange(
        StringComparer.Ordinal,
        [
            KeyValuePair.Create("attributions-events.json#a10-author-of-the-other-team-is-ignored", IgnoredAttribution),
            KeyValuePair.Create("attributions-events.json#a11-an-ignored-attribution-does-not-erase-the-valid-one", IgnoredAttribution),
            KeyValuePair.Create("attributions-events.json#a13-attribution-before-the-point-in-the-canonical-order", NotOneWriterInOrder),
            KeyValuePair.Create("attributions-events.json#a6-attribution-of-a-reverted-point-is-ignored", IgnoredAttribution),
            KeyValuePair.Create("attributions-events.json#a7-attribution-of-an-event-that-is-not-a-point-is-ignored", IgnoredAttribution),
            KeyValuePair.Create("attributions-events.json#a9-attribution-to-a-point-of-an-earlier-match-is-ignored", IgnoredAttribution),
            KeyValuePair.Create("bench-events.json#c13-change-with-the-set-closed-and-the-match-open", ShortcutSetEnd),
            KeyValuePair.Create("bench-events.json#c8-last-set-keeps-them-without-a-next-set", ShortcutSetEnd),
            KeyValuePair.Create("bench-events.json#c8-next-set-keeps-bench-and-lineup", ShortcutSetEnd),
            KeyValuePair.Create("corrections-events.json#c12-at-0-0-the-recorded-first-server-stays", AppliedAsRecorded),
            KeyValuePair.Create("corrections-events.json#c12-first-server-is-recorded-as-it-comes", AppliedAsRecorded),
            KeyValuePair.Create("corrections-events.json#c12-of-two-writers-the-last-in-the-canonical-order-wins", NotOneWriterInOrder),
            KeyValuePair.Create("corrections-events.json#c12-the-current-values-change-nothing", AppliedAsRecorded),
            KeyValuePair.Create("corrections-events.json#c14-stale-girar-of-another-writer-keeps-the-recorded-zone", NotOneWriterInOrder),
            KeyValuePair.Create("libero-events.json#l6-points-after-the-stale-change-rotate-from-it", NotOneWriterInOrder),
            KeyValuePair.Create("libero-events.json#l6-stale-change-of-another-writer-is-applied", NotOneWriterInOrder),
            KeyValuePair.Create("queue-events.json#e8-interleaved-writers-the-last-in-canonical-order-wins", NotOneWriterInOrder),
            KeyValuePair.Create("rotation-events.json#s11-arrival-order-does-not-change-it", NotOneWriterInOrder),
            KeyValuePair.Create("rotation-events.json#s11-interleaved-writers-are-not-rejected", NotOneWriterInOrder),
            KeyValuePair.Create("rotation-events.json#s12-another-rules-version-has-the-same-transition", UnsupportedVersion),
            KeyValuePair.Create("rotation-events.json#s16-system-survives-the-next-set", ShortcutSetEnd),
            KeyValuePair.Create("rotation-events.json#s16-unknown-formations-version-is-applied-as-recorded", UnsupportedVersion),
            KeyValuePair.Create("rotation-events.json#s8-deciding-set-ended-keeps-the-last-zones", ShortcutSetEnd),
            KeyValuePair.Create("rotation-events.json#s8-first-rally-next-set-receiver-wins", ShortcutSetEnd),
            KeyValuePair.Create("rotation-events.json#s8-first-rally-next-set-server-wins", ShortcutSetEnd),
            KeyValuePair.Create("rotation-events.json#s8-first-server-against-alternation-is-applied-as-recorded", AppliedAsRecorded),
            KeyValuePair.Create("rotation-events.json#s8-zones-against-the-last-set-are-applied-as-recorded", AppliedAsRecorded),
            KeyValuePair.Create("rotation-events.json#s9-revert-over-set-ended", ShortcutSetEnd),
            KeyValuePair.Create("score-events.json#g14-match-end-against-the-sets-is-applied-as-recorded", AppliedAsRecorded),
            KeyValuePair.Create("score-events.json#g14-next-target-against-the-rule-is-applied-as-recorded", AppliedAsRecorded),
            KeyValuePair.Create("score-events.json#g14-set-ended-at-10-8-is-applied-as-recorded", AppliedAsRecorded),
            KeyValuePair.Create("score-events.json#g14-winner-behind-is-applied-as-recorded", AppliedAsRecorded),
            KeyValuePair.Create("score-events.json#g18-set-ended-resent-is-ignored", ResendInTheLog),
            KeyValuePair.Create("score-events.json#g9-frozen-copy-with-another-rules-version", UnsupportedVersion),
        ]);

    private static readonly string InitialState = CourtSessionStateWriter.ToJson(CourtSessionState.Initial);

    private static readonly ImmutableArray<(string File, JsonElement Case)> AcceptedCases =
    [
        .. GoldenFiles.SelectMany(file => GoldenFile.ReadEmbeddedCases(file)
            .Where(goldenCase => IsAccepted(goldenCase) && StartsEmpty(goldenCase))
            .Select(goldenCase => (file, goldenCase))),
    ];

    public static TheoryData<string> Candidates => new(AcceptedCases
        .Select(item => Key(item.File, item.Case))
        .Where(key => !Exclusions.ContainsKey(key)));

    public static TheoryData<string> Excluded => new(Exclusions.Keys);

    [Fact]
    public void GoldenFiles_HaveCandidates()
    {
        Assert.True(Candidates.Count > GoldenFiles.Length);
    }

    [Theory]
    [MemberData(nameof(Candidates))]
    public void AcceptedLog_IsAcceptedAtOnce(string key)
    {
        var events = EventsOf(key);
        var stored = ImmutableArray<StreamEvent>.Empty;
        foreach (var chunk in events.Chunk(CourtStreamLimits.MaxEventsPerRequest))
        {
            var stream = stored.IsEmpty ? StoredStream.New : CourtWriteFixture.Stored(stored);
            stored = stored.AddRange(CourtWriteFixture.Accepted(Decide(stream, [.. chunk], key)).NewEvents);
        }

        Assert.Equal(events.Length, stored.Length);
    }

    [Theory]
    [MemberData(nameof(Candidates))]
    public void AcceptedLog_IsAcceptedOneEventPerRequest(string key)
    {
        var stored = ImmutableArray<StreamEvent>.Empty;
        foreach (var item in EventsOf(key))
        {
            var stream = stored.IsEmpty ? StoredStream.New : CourtWriteFixture.Stored(stored);
            stored = stored.AddRange(CourtWriteFixture.Accepted(Decide(stream, [item], key)).NewEvents);
        }
    }

    /// <summary>
    /// As the server runs (ADR 0081): each request over the snapshot the previous write left, never rebuilt, which
    /// always continues for one writer in order and ends as the snapshot of the whole log built at once.
    /// </summary>
    [Theory]
    [MemberData(nameof(Candidates))]
    public void AcceptedLog_IsAcceptedOneEventPerRequest_OnTheSnapshotOfTheLastWrite(string key)
    {
        var events = EventsOf(key);
        var stream = StoredStream.New;
        foreach (var item in events)
        {
            var decision = CourtWriteFixture.Accepted(Decide(stream, [item], key));
            Assert.NotNull(decision.Snapshot);
            stream = StoredStream.Of(decision.Snapshot, [decision.Writer]);
        }

        StreamSnapshotEquivalenceTests.AssertSameSnapshot(
            events.IsEmpty ? StreamSnapshot.Empty : StreamSnapshot.Empty.Advance(events[0].Envelope.CourtSessionId, events), stream.Snapshot, key);
    }

    /// <summary>An exclusion that names no accepted case, or that the rules now accept, is stale and must go.</summary>
    [Theory]
    [MemberData(nameof(Excluded))]
    public void Exclusion_IsAnAcceptedCaseTheRulesRefuse(string key)
    {
        Assert.Contains(key, AcceptedCases.Select(item => Key(item.File, item.Case)));
        var events = EventsOf(key);

        var request = CourtWriteRequest.Create(events[0].Envelope.CourtSessionId, events, SupportedVersions.EventSchemaVersions);

        Assert.True(request.IsFailure || CourtWriteRules.Decide(StoredStream.New, request.Value, ContextFor(events)).IsFailure);
    }

    private static Result<CourtWriteDecision, CourtWriteError> Decide(
        StoredStream stream,
        ImmutableArray<StreamEvent> events,
        string key)
    {
        var request = CourtWriteRequest.Create(events[0].Envelope.CourtSessionId, events, SupportedVersions.EventSchemaVersions);
        Assert.True(request.IsSuccess, $"{key}: {request}");
        return CourtWriteRules.Decide(stream, request.Value, ContextFor(events));
    }

    /// <summary>The golden files have no group: every member they name belongs to it.</summary>
    private static CourtWriteContext ContextFor(ImmutableArray<StreamEvent> events) =>
        CourtWriteFixture.Context with
        {
            GroupMemberIds = CourtEventMembers.Collect(events.Select(item => item.Envelope)).ToImmutableHashSet(StringComparer.Ordinal),
        };

    private static ImmutableArray<StreamEvent> EventsOf(string key)
    {
        var (_, goldenCase) = AcceptedCases.Single(item => Key(item.File, item.Case) == key);
        return ServerChecksGoldenTests.EventsOf(goldenCase);
    }

    private static string Key(string file, JsonElement goldenCase) => $"{file}#{GoldenFile.IdOf(goldenCase)}";

    private static bool IsAccepted(JsonElement goldenCase) =>
        goldenCase.TryGetProperty("expected", out var expected)
        && expected.ValueKind == JsonValueKind.Object
        && expected.TryGetProperty("ok", out var ok)
        && ok.ValueKind == JsonValueKind.True;

    private static bool StartsEmpty(JsonElement goldenCase) =>
        goldenCase.TryGetProperty("initialState", out var initial)
        && CourtSessionStateWriter.ToJson(CourtSessionStateReader.Read(initial)) == InitialState;
}
