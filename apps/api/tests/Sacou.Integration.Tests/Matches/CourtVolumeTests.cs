using System.Diagnostics;
using System.Globalization;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Npgsql;
using NpgsqlTypes;
using Sacou.Integration.Tests.Groups;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Matches;

/// <summary>
/// A10 of E3.7, on the path of ADR 0081: a stream at its ceiling of 20,000 events. The first goes through the route,
/// 19,998 are copied straight to the table, the 19,999th goes through the route and builds the snapshot outside the lock
/// (cold, only logged), and the 20,000th goes through the route on the snapshot (hot, measured). With
/// <c>SACOU_PERF_GATE=1</c> in Release, the median of five hot requests, each on a new stream, stays under 500 ms and
/// every cold one holds the lock under 500 ms; otherwise one round, with a generous ceiling that only catches a
/// quadratic slip. The times and the memory the snapshot keeps go to the test output, for the PR and the ADR.
/// </summary>
public sealed partial class CourtVolumeTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int StreamCeiling = 20_000;
    private const int PointsPerMatch = 1_400;
    private const int GatedRounds = 5;
    private const int UngatedRounds = 1;
    private const double BytesPerMebibyte = 1024.0 * 1024.0;
    private const string GateVariable = "SACOU_PERF_GATE";
    private const string GateOn = "1";

    /// <summary>The acceptance of E5.3b: the 20,000th event, and the lock of a cold one, under half a second in Release.</summary>
    private static readonly TimeSpan Budget = TimeSpan.FromMilliseconds(500);

    /// <summary>Far above the budget: it only catches a quadratic slip, never a slow machine.</summary>
    private static readonly TimeSpan Generous = TimeSpan.FromSeconds(30);

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

#if DEBUG
    private const bool InRelease = false;
#else
    private const bool InRelease = true;
#endif

    /// <summary>Only Release measures the budget: Debug is many times slower and only checks the shape.</summary>
    private static bool Gated =>
        InRelease && string.Equals(Environment.GetEnvironmentVariable(GateVariable), GateOn, StringComparison.Ordinal);

    [Fact]
    public async Task TheLastEventOfAFullStream_IsDecidedInTime()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await WarmAsync(world);

        var rounds = new List<Measure>();
        for (var round = 0; round < (Gated ? GatedRounds : UngatedRounds); round++)
        {
            rounds.Add(await MeasureAsync(world, checkTheCeiling: round == 0));
        }

        var hot = rounds.Select(measure => measure.HotMs).Order().ToList();
        var medianHotMs = hot[hot.Count / 2];
        foreach (var measure in rounds)
        {
            TestContext.Current.TestOutputHelper?.WriteLine(string.Create(CultureInfo.InvariantCulture,
                $"A10: event {StreamCeiling - 1} cold {measure.ColdMs} ms ({measure.ColdLockedMs} ms locked, {measure.ColdSnapshot}); event {StreamCeiling} hot {measure.HotMs} ms ({measure.HotLockedMs} ms locked, {measure.HotSnapshot}); snapshot keeps {measure.RetainedMebibytes:F1} MiB."));
        }

        TestContext.Current.TestOutputHelper?.WriteLine(string.Create(CultureInfo.InvariantCulture,
            $"A10: median hot {medianHotMs} ms over {rounds.Count} streams; gate {(Gated ? "on" : "off")}."));
        Assert.All(rounds, measure => Assert.Equal(("built", "hit"), (measure.ColdSnapshot, measure.HotSnapshot)));
        Assert.True(TimeSpan.FromMilliseconds(medianHotMs) < Generous, $"{medianHotMs} ms");
        if (Gated)
        {
            Assert.True(TimeSpan.FromMilliseconds(medianHotMs) < Budget, $"median hot {medianHotMs} ms");
            Assert.All(rounds, measure => Assert.True(TimeSpan.FromMilliseconds(measure.ColdLockedMs) < Budget, $"cold locked {measure.ColdLockedMs} ms"));
        }
    }

    /// <summary>The path once on another stream, cold and hot, so the measure is the request, not the first JIT.</summary>
    private async Task WarmAsync(GroupWorld world)
    {
        var warm = CourtPhone.New();
        var warmRound = await CourtCalls.RoundAsync(world);
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, warmRound, warm, [warm.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);
        await CopyAsync(warm.CourtSessionId, [.. warm.AlternatingPoints(PointsPerMatch)]);
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, warmRound, warm, [warm.Point("a")]);
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, warmRound, warm, [warm.Point("b")]);
    }

    private async Task<Measure> MeasureAsync(GroupWorld world, bool checkTheCeiling)
    {
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        var envelopes = FullStream(phone, world.MemberIds[A.Admin], world.MemberIds[A.Player]);
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [envelopes[0]]);
        await CopyAsync(phone.CourtSessionId, envelopes[1..^2]);

        var retainedBefore = GC.GetTotalMemory(forceFullCollection: true);
        var (coldMs, coldLockedMs, coldSnapshot) = await TimedWriteAsync(world, round, phone, envelopes[^2], StreamCeiling - 1);
        var retainedMebibytes = (GC.GetTotalMemory(forceFullCollection: true) - retainedBefore) / BytesPerMebibyte;
        var (hotMs, hotLockedMs, hotSnapshot) = await TimedWriteAsync(world, round, phone, envelopes[^1], StreamCeiling);

        if (checkTheCeiling)
        {
            using var over = await CourtCalls.SendAsync(world, A.Scorekeeper, round, phone, [phone.Point("a")]);
            Assert.Equal((System.Net.HttpStatusCode)StatusCodes.UnprocessableContent, over.StatusCode);
            Assert.Equal("matches.limit-reached", await Sessions.RoundCalls.CodeAsync(over));
        }

        return new Measure(coldMs, coldLockedMs, coldSnapshot, hotMs, hotLockedMs, hotSnapshot, retainedMebibytes);
    }

    /// <summary>One event through the route: the time the client saw, and the lock and the snapshot the log line told.</summary>
    private async Task<(long Ms, long LockedMs, string Snapshot)> TimedWriteAsync(GroupWorld world, string round, CourtPhone phone, string envelope, long expectedSequence)
    {
        var logsBefore = api.Logs.Count;
        var clock = Stopwatch.StartNew();
        var written = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [envelope]);
        clock.Stop();
        Assert.Equal((expectedSequence, 1), written);
        var line = api.Logs.EntriesSince(logsBefore).Select(entry => StoredLine().Match(entry)).Single(match => match.Success);
        return (clock.ElapsedMilliseconds, long.Parse(line.Groups["locked"].Value, CultureInfo.InvariantCulture), line.Groups["snapshot"].Value);
    }

    [GeneratedRegex(@"Court events stored\..* (?<locked>\d+) ms locked, snapshot (?<snapshot>[a-z]+)\.")]
    private static partial Regex StoredLine();

    /// <summary>Matches of a start, 1,400 points that never decide the set and a manual end, cut at the ceiling.</summary>
    private static string[] FullStream(CourtPhone phone, Guid teamA, Guid teamB)
    {
        var envelopes = new List<string>(StreamCeiling);
        while (envelopes.Count < StreamCeiling)
        {
            envelopes.Add(phone.MatchStarted(teamA, teamB));
            envelopes.AddRange(phone.AlternatingPoints(Math.Min(PointsPerMatch, StreamCeiling - envelopes.Count)));
            if (envelopes.Count < StreamCeiling)
            {
                envelopes.Add(phone.ManualEnd());
            }
        }

        return [.. envelopes];
    }

    /// <summary>The rows the route would write, positions 2 onwards, and the counters with them.</summary>
    private async Task CopyAsync(Guid courtSessionId, string[] envelopes)
    {
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        var now = DateTimeOffset.UtcNow;
        await using (var copy = await connection.BeginBinaryImportAsync(
            "COPY matches.court_events (court_session_id, position, event_id, batch, sequence, device_id, schema_version, type, match_id, envelope, received_at) FROM STDIN (FORMAT BINARY)",
            TestContext.Current.CancellationToken))
        {
            for (var index = 0; index < envelopes.Length; index++)
            {
                var json = JsonNode.Parse(envelopes[index])!.AsObject();
                var matchId = json["payload"]!["matchId"]?.GetValue<string>();
                await copy.StartRowAsync(TestContext.Current.CancellationToken);
                await copy.WriteAsync(courtSessionId, NpgsqlDbType.Uuid, TestContext.Current.CancellationToken);
                await copy.WriteAsync(index + 2, NpgsqlDbType.Integer, TestContext.Current.CancellationToken);
                await copy.WriteAsync(Guid.Parse(json["eventId"]!.GetValue<string>()), NpgsqlDbType.Uuid, TestContext.Current.CancellationToken);
                await copy.WriteAsync(json["batch"]!.GetValue<long>(), NpgsqlDbType.Bigint, TestContext.Current.CancellationToken);
                await copy.WriteAsync(json["sequence"]!.GetValue<long>(), NpgsqlDbType.Bigint, TestContext.Current.CancellationToken);
                await copy.WriteAsync(Guid.Parse(json["deviceId"]!.GetValue<string>()), NpgsqlDbType.Uuid, TestContext.Current.CancellationToken);
                await copy.WriteAsync(json["schemaVersion"]!.GetValue<long>(), NpgsqlDbType.Bigint, TestContext.Current.CancellationToken);
                await copy.WriteAsync(json["type"]!.GetValue<string>(), NpgsqlDbType.Text, TestContext.Current.CancellationToken);
                if (matchId is null)
                {
                    await copy.WriteNullAsync(TestContext.Current.CancellationToken);
                }
                else
                {
                    await copy.WriteAsync(Guid.Parse(matchId), NpgsqlDbType.Uuid, TestContext.Current.CancellationToken);
                }
                await copy.WriteAsync(envelopes[index], NpgsqlDbType.Text, TestContext.Current.CancellationToken);
                await copy.WriteAsync(now, NpgsqlDbType.TimestampTz, TestContext.Current.CancellationToken);
            }

            _ = await copy.CompleteAsync(TestContext.Current.CancellationToken);
        }

        await CourtCalls.ExecuteAsync(api.ConnectionString,
            "UPDATE matches.court_sessions SET event_count = event_count + @count, envelope_bytes = envelope_bytes + @bytes WHERE id = @id",
            ("count", envelopes.Length), ("bytes", (long)envelopes.Sum(item => Encoding.UTF8.GetByteCount(item))), ("id", courtSessionId));
    }

    private sealed record Measure(
        long ColdMs, long ColdLockedMs, string ColdSnapshot, long HotMs, long HotLockedMs, string HotSnapshot, double RetainedMebibytes);
}
