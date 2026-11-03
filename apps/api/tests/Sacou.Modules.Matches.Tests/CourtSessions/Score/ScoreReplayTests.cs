using System.Collections.Immutable;
using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Queue;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.Appliers;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Score;

/// <summary>The appliers through the replay: order, totality on hostile input, and the match history.</summary>
[SuppressMessage("Security", "CA5394:Do not use insecure randomness", Justification = "A fixed seed makes the fuzz repeatable; nothing here is secret.")]
public sealed class ScoreReplayTests
{
    private const string Court = "c0000000-0000-4000-8000-000000000001";
    private const string Device = "d0000000-0000-4000-8000-000000000001";
    private const string MatchId = "f0000000-0000-4000-8000-000000000001";
    private const string Canary = "CANARY-fictional.player@example.com";
    private const int PermutationsOfSix = 720;
    private const int Seed = 20_261_105;
    private const int MutationsPerCase = 10;
    private const string Placeholder = "HOSTILE-VALUE-PLACEHOLDER";

    private static readonly IReadOnlyList<JsonElement> PayloadCases = GoldenFile.ReadEmbeddedCases("score-payloads.json");
    private static readonly IReadOnlyList<JsonElement> EventCases = GoldenFile.ReadEmbeddedCases("score-events.json");

    private static readonly string[] HostileValues =
    [
        "1e99999999999", "2.5", "-1", "0", "null", "true", "[]", "{}", $"\"{Canary}\"",
        $$"""{"{{Canary}}":1}""", $"[{string.Join(",", Enumerable.Repeat("0", 5_000))}]",
        "\"f0000000-0000-4000-8000-000000000099\"", "\"b\"", "6",
    ];

    [Fact]
    public void EveryArrivalOrder_GivesTheSameStateText()
    {
        EventEnvelope[] log =
        [
            Envelope(1, ScoreEventTypes.MatchStarted, Payload("MatchStarted-valid")),
            Point(2, "a"),
            Point(3, "b"),
            Point(4, "b"),
            Envelope(5, EventLogSchema.RevertedToEventType, $$"""{"targetEventId":"{{EventId(3)}}"}"""),
            Point(6, "a"),
        ];
        var expected = StateText(log);

        var orders = Permutations([.. log]).ToList();

        Assert.Equal(PermutationsOfSix, orders.Count);
        Assert.All(orders, order => Assert.Equal(expected, StateText(order)));
    }

    /// <summary>Appliers are total: hostile payloads in accepted logs never throw and never echo (ADR 0033, D11).</summary>
    [Fact]
    public void MutatedLogs_NeverThrow_AndNeverEcho()
    {
        var random = new Random(Seed);
        var rejected = 0;
        foreach (var goldenCase in EventCases.Where(goldenCase => goldenCase.GetProperty("expected").GetProperty("ok").GetBoolean()))
        {
            var events = goldenCase.GetProperty("events").EnumerateArray().Select(rawEvent => rawEvent.GetRawText()).ToList();
            for (var mutation = 0; mutation < MutationsPerCase && events.Count > 0; mutation++)
            {
                var index = random.Next(events.Count);
                var mutated = events.ToList();
                mutated[index] = MutatePayload(mutated[index], random);

                var parsed = mutated.Select(text => EnvelopeParser.Parse(RawValueReader.Parse(text))).ToList();
                if (parsed.Any(envelope => envelope.IsFailure))
                {
                    continue;
                }

                var replayed = EventReplayer.ReplayEvents(ScoreAppliers.Config(Court), parsed.Select(envelope => envelope.Value));
                rejected += replayed.IsFailure ? 1 : 0;
                Assert.DoesNotContain(Canary, replayed.ToString(), StringComparison.Ordinal);
            }
        }

        Assert.True(rejected > 0, "No mutation reached an applier.");
    }

    [Fact]
    public void MatchHistory_CountsInARow_AndInAll()
    {
        var finished = Enumerable.Range(1, 3)
            .Select(number => Finished(number % 2 == 1 ? ["m1", "m2"] : ["m2"]))
            .ToImmutableArray();
        var state = CourtSessionState.Initial with { FinishedMatches = finished };

        Assert.Equal(1, MatchHistory.GetConsecutiveMatches(state, "m1"));
        Assert.Equal(2, MatchHistory.GetMatchesPlayed(state, "m1"));
        Assert.Equal(3, MatchHistory.GetConsecutiveMatches(state, "m2"));
        Assert.Equal(0, MatchHistory.GetConsecutiveMatches(state, "M2"));
        Assert.Equal(0, MatchHistory.GetConsecutiveMatches(CourtSessionState.Initial, "m1"));
    }

    private static FinishedMatch Finished(ImmutableArray<string> teamA) =>
        new(
            new MatchScore(
                [], null, 1, MatchId, new BySide<Domain.CourtSessions.Rotation.TeamState?>(null, null), 1,
                new ScoringRules(1, 25, null, 2), new BySide<int>(0, 0),
                new BySide<TeamRoster>(new TeamRoster(teamA), new TeamRoster(["x"]))),
            MatchEndReason.Manual,
            null);

    private static string MutatePayload(string rawEvent, Random random)
    {
        var envelope = JsonNode.Parse(rawEvent)!.AsObject();
        if (envelope["payload"] is not JsonObject payload || payload.Count == 0)
        {
            return rawEvent;
        }

        var keys = payload.Select(member => member.Key).ToList();
        var key = random.Next(2) == 0 ? keys[random.Next(keys.Count)] : Canary;
        payload[key] = Placeholder;
        return envelope.ToJsonString().Replace($"\"{Placeholder}\"", HostileValues[random.Next(HostileValues.Length)], StringComparison.Ordinal);
    }

    private static string StateText(IEnumerable<EventEnvelope> log)
    {
        var replayed = EventReplayer.ReplayEvents(ScoreAppliers.Config(Court), log);
        Assert.True(replayed.IsSuccess, $"Expected a replay, got {replayed}.");
        return CourtSessionStateWriter.ToJson(replayed.Value.State) + string.Join(",", replayed.Value.ActiveEventIds);
    }

    private static EventEnvelope Point(long number, string team) =>
        Envelope(number, ScoreEventTypes.PointScored, $$"""{"matchId":"{{MatchId}}","setNumber":1,"team":"{{team}}"}""");

    private static EventEnvelope Envelope(long number, string type, string payload)
    {
        var json = $$"""
            {"eventId":"{{EventId(number)}}","courtSessionId":"{{Court}}","deviceId":"{{Device}}","batch":1,"sequence":{{number.ToString(CultureInfo.InvariantCulture)}},"schemaVersion":1,"type":"{{type}}","payload":{{payload}}}
            """;
        var parsed = EnvelopeParser.Parse(RawValueReader.Parse(json));
        Assert.True(parsed.IsSuccess, $"Expected a valid envelope, got {parsed}.");
        return parsed.Value;
    }

    private static string EventId(long number) => $"e0000000-0000-4000-8000-{number.ToString("D12", CultureInfo.InvariantCulture)}";

    private static string Payload(string id) =>
        GoldenFile.SingleCase(PayloadCases, GoldenFile.IdOf, id).GetProperty("payload").GetRawText();

    private static IEnumerable<ImmutableArray<T>> Permutations<T>(ImmutableArray<T> items) =>
        items.Length <= 1
            ? [items]
            : items.SelectMany((item, index) => Permutations(items.RemoveAt(index)).Select(rest => rest.Insert(0, item)));
}
