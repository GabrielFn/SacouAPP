using System.Diagnostics;
using System.Globalization;
using System.Text;
using System.Text.Json.Nodes;
using Npgsql;
using NpgsqlTypes;
using Sacou.Integration.Tests.Groups;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Matches;

/// <summary>
/// A10 of E3.7: a stream at its ceiling of 20,000 events. 19,999 are copied straight to the table, then the last one
/// goes through the route, which loads, parses, replays and decides the whole stream. The time and the memory of that
/// request go to the test output, for the PR (ADR 0060, D9).
/// </summary>
public sealed class CourtVolumeTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int StreamCeiling = 20_000;
    private const int PointsPerMatch = 1_400;

    /// <summary>Far above the ~0.35 s of the plan: it only catches a quadratic slip, never a slow machine.</summary>
    private static readonly TimeSpan Generous = TimeSpan.FromSeconds(30);

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task TheLastEventOfAFullStream_IsDecidedInTime()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        var envelopes = FullStream(phone, world.MemberIds[A.Admin], world.MemberIds[A.Player]);
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [envelopes[0]]);
        await CopyAsync(phone.CourtSessionId, envelopes[1..^1]);

        // Warm the path once on another stream, so the measure is the request, not the first JIT of the replay.
        var warm = CourtPhone.New();
        var warmRound = await CourtCalls.RoundAsync(world);
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, warmRound, warm, [warm.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]), warm.Point("a")]);

        var allocatedBefore = GC.GetTotalAllocatedBytes(precise: true);
        var clock = Stopwatch.StartNew();
        var written = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [envelopes[^1]]);
        clock.Stop();
        var allocatedMegabytes = (GC.GetTotalAllocatedBytes(precise: true) - allocatedBefore) / (1024.0 * 1024.0);

        TestContext.Current.TestOutputHelper?.WriteLine(string.Create(CultureInfo.InvariantCulture,
            $"A10: event {StreamCeiling} of a full stream ({envelopes.Sum(item => Encoding.UTF8.GetByteCount(item)) / 1024} KiB): {clock.ElapsedMilliseconds} ms, {allocatedMegabytes:F1} MiB allocated."));
        Assert.Equal((StreamCeiling, 1), written);
        Assert.True(clock.Elapsed < Generous, $"{clock.ElapsedMilliseconds} ms");

        using var over = await CourtCalls.SendAsync(world, A.Scorekeeper, round, phone, [phone.Point("a")]);
        Assert.Equal((System.Net.HttpStatusCode)StatusCodes.UnprocessableContent, over.StatusCode);
        Assert.Equal("matches.limit-reached", await Sessions.RoundCalls.CodeAsync(over));
    }

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
}
