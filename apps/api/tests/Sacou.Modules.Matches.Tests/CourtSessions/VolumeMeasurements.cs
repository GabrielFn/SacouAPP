using System.Collections.Immutable;
using System.Diagnostics;
using System.Globalization;
using System.Text;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.Appliers;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions;

/// <summary>
/// The D13 measurement of ADR 0033, with the scenarios the TypeScript port measured
/// (<c>modelo-de-ameacas.md</c>). Explicit, so it never runs on CI, and without any time assertion:
/// it prints the numbers. Run with <c>--explicit only</c>, and with <c>DOTNET_GCHeapHardLimit</c> for the
/// failure point.
/// </summary>
public sealed class VolumeMeasurements
{
    private const int Events = 64_000;
    private const int Runs = 5;
    private const int TeamMembers = 24;
    private const int LineupMembers = 6;
    private const int QueueTeams = 4;
    private const int FinishedMatches = 200;
    private const int BytesPerMegabyte = 1_048_576;
    private const string Court = "c0000000-0000-4000-8000-000000000001";
    private const string Device = "d0000000-0000-4000-8000-000000000001";
    private const string MatchId = "f0000000-0000-4000-8000-000000000001";

    [Fact(Explicit = true)]
    public void SimplePoints() =>
        Measure("64k simple points", [MatchStarted(MatchId, rotationsOn: false), .. Enumerable.Range(0, Events).Select(_ => Point("a"))]);

    [Fact(Explicit = true)]
    public void PointsWithSideOutEveryRally() =>
        Measure(
            "64k points, rotation on, 24 per team, side-out every point",
            [MatchStarted(MatchId, rotationsOn: true), .. Enumerable.Range(0, Events).Select(index => Point(index % 2 == 0 ? "b" : "a"))]);

    [Fact(Explicit = true)]
    public void LineupChanges() =>
        Measure(
            "64k LineupChanged, 24 per team",
            [MatchStarted(MatchId, rotationsOn: true), .. Enumerable.Range(0, Events).Select(LineupChanged)]);

    [Fact(Explicit = true)]
    public void QueueChangesWithTheLargestQueue() =>
        Measure(
            "64k QueueChanged, queue of 96",
            [MatchStarted(MatchId, rotationsOn: false), .. Enumerable.Range(0, Events).Select(_ => QueueChanged())]);

    [Fact(Explicit = true)]
    public void TwoHundredFinishedMatches() =>
        Measure(
            "200 finished matches",
            [.. Enumerable.Range(1, FinishedMatches).SelectMany(number =>
                new[] { MatchStarted(MatchIdOf(number), rotationsOn: true), MatchEnded(MatchIdOf(number)) })]);

    private static void Measure(string scenario, ImmutableArray<string> payloads)
    {
        ImmutableArray<string> log = [.. payloads.Select((payload, index) => payload
            .Replace("@ID@", (index + 1).ToString("D12", CultureInfo.InvariantCulture), StringComparison.Ordinal)
            .Replace("@SEQ@", (index + 1).ToString(CultureInfo.InvariantCulture), StringComparison.Ordinal))];
        var bytes = log.Sum(text => (long)Encoding.UTF8.GetByteCount(text));
        var before = GC.GetTotalMemory(forceFullCollection: true);

        var parsed = ImmutableArray<EventEnvelope>.Empty;
        var parseTimes = Enumerable.Range(0, Runs).Select(_ => Time(() => parsed = Parse(log))).Order().ToList();
        var replayed = EventReplayer.ReplayTimeline(ScoreAppliers.Config(Court), parsed);
        var replayTimes = Enumerable.Range(0, Runs).Select(_ => Time(() => replayed = EventReplayer.ReplayTimeline(ScoreAppliers.Config(Court), parsed))).Order().ToList();
        var retained = GC.GetTotalMemory(forceFullCollection: true) - before;

        Assert.True(replayed.IsSuccess, $"{scenario}: {replayed}");
        TestContext.Current.TestOutputHelper?.WriteLine(
            $"{scenario}: {log.Length} events, {bytes / (double)BytesPerMegabyte:F1} MB of log, parse median {parseTimes[Runs / 2]:F2} s, "
            + $"replay median {replayTimes[Runs / 2]:F2} s, {retained / (double)BytesPerMegabyte:F1} MB retained with the log, "
            + $"{replayed.Value.Entries.Length} active, {replayed.Value.Entries[^1].State.FinishedMatches.Length} finished");
        GC.KeepAlive(log);
        GC.KeepAlive(parsed);
        GC.KeepAlive(replayed);
    }

    private static ImmutableArray<EventEnvelope> Parse(ImmutableArray<string> log) =>
        [.. log.Select(text => EnvelopeParser.Parse(RawValueReader.Parse(text)).Value)];

    private static double Time(Action action)
    {
        var started = Stopwatch.GetTimestamp();
        action();
        return Stopwatch.GetElapsedTime(started).TotalSeconds;
    }

    private static string Envelope(string type, string payload) =>
        $$"""{"eventId":"e0000000-0000-4000-8000-@ID@","courtSessionId":"{{Court}}","deviceId":"{{Device}}","batch":1,"sequence":@SEQ@,"schemaVersion":1,"type":"{{type}}","payload":{{payload}}}""";

    private static string Member(char team, int number) =>
        $"{team}0000000-0000-4000-8000-{number.ToString("D12", CultureInfo.InvariantCulture)}";

    private static string Members(char team, IEnumerable<int> numbers) =>
        "[" + string.Join(",", numbers.Select(number => $"\"{Member(team, number)}\"")) + "]";

    private static string Roster(char team, IEnumerable<int> numbers) => "{\"memberIds\":" + Members(team, numbers) + "}";

    private static string Teams() =>
        "{\"a\":" + Roster('a', Enumerable.Range(1, TeamMembers)) + ",\"b\":" + Roster('b', Enumerable.Range(1, TeamMembers)) + "}";

    private static string MatchIdOf(int number) => $"f0000000-0000-4000-8000-{number.ToString("D12", CultureInfo.InvariantCulture)}";

    private static string MatchStarted(string matchId, bool rotationsOn)
    {
        string Rotation(char team) => rotationsOn
            ? $$"""{"bench":{{Members(team, Enumerable.Range(LineupMembers + 1, TeamMembers - LineupMembers))}},"libero":null,"lineup":{{Members(team, Enumerable.Range(1, LineupMembers))}},"setterZone":1,"system":"5x1"}"""
            : "null";
        var payload = "{\"matchId\":\"" + matchId + "\",\"rulesVersion\":1,\"formationsVersion\":1,"
            + "\"scoring\":{\"bestOf\":1,\"pointsPerSet\":99,\"tieBreakPoints\":null,\"winMargin\":2},"
            + "\"teams\":" + Teams() + ",\"firstServer\":\"a\","
            + "\"rotations\":{\"a\":" + Rotation('a') + ",\"b\":" + Rotation('b') + "},"
            + "\"queue\":{\"players\":[],\"teams\":[]}}";
        return Envelope(ScoreEventTypes.MatchStarted, payload);
    }

    private static string Point(string team) =>
        Envelope(ScoreEventTypes.PointScored, $$"""{"matchId":"{{MatchId}}","setNumber":1,"team":"{{team}}"}""");

    /// <summary>Six of the team in the lineup and the other eighteen on the bench, shifting by one each time.</summary>
    private static string LineupChanged(int index)
    {
        var order = Enumerable.Range(1, TeamMembers).Select(number => ((number + index) % TeamMembers) + 1).ToList();
        var payload = $$"""
            {"matchId":"{{MatchId}}","team":"a","lineup":{{Members('a', order.Take(LineupMembers))}},"setterZone":1,"bench":{{Members('a', order.Skip(LineupMembers))}},"libero":null}
            """;
        return Envelope(ScoreEventTypes.LineupChanged, payload);
    }

    private static string QueueChanged()
    {
        var teams = string.Join(",", Enumerable.Range(0, QueueTeams).Select(team =>
            Roster('c', Enumerable.Range((team * TeamMembers) + 1, TeamMembers))));
        return Envelope(ScoreEventTypes.QueueChanged, "{\"matchId\":\"" + MatchId + "\",\"queue\":{\"players\":[],\"teams\":[" + teams + "]}}");
    }

    private static string MatchEnded(string matchId) =>
        Envelope(ScoreEventTypes.MatchEnded, $$"""{"matchId":"{{matchId}}","endReason":"manual","winner":null}""");
}
