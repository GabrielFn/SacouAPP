using System.Net;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Npgsql;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.RateLimiting;
using Sacou.Integration.Tests.Sessions;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Matches;

/// <summary>
/// The guards of the court's writes against a real Postgres (ADR 0081, Part 2): the snapshot handed from the warm-up to
/// the lock, never the whole stream under the lock, nothing kept from a commit that fails, the transaction's timeouts,
/// the court-sync concurrency per user, and a close again that never summarizes the court.
/// </summary>
public sealed partial class CourtGuardsTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string CourtBusy = "matches.court-busy";
    private const string ShortLockTimeout = "200";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>Condition 1: the snapshot evicted between the warm-up and the lock is still the one the write uses: no build, then kept again.</summary>
    [Fact]
    public async Task ASnapshotEvictedBetweenTheWarmUpAndTheLock_IsStillTheOneTheWriteUses()
    {
        using var client = api.CreateClient();
        var (world, round, phone) = await StreamAsync(api, client);
        api.AfterSnapshotWarmed = (stream, cache) =>
        {
            cache.Evict(stream);
            return Task.CompletedTask;
        };
        try
        {
            Assert.Equal("hit", await SnapshotOfWriteAsync(world, round, phone, phone.Point("b")));
        }
        finally
        {
            api.AfterSnapshotWarmed = null;
        }

        Assert.Equal("hit", await SnapshotOfWriteAsync(world, round, phone, phone.Point("a")));
        Assert.Equal(4, await CourtCalls.EventCountAsync(api.ConnectionString, phone.CourtSessionId));
    }

    /// <summary>
    /// Condition 1: under the lock the handed-over snapshot no longer matches the stream (its last event was rewritten
    /// in between): the write is a 503 with nothing stored, never a replay of the whole stream under the lock; the
    /// next try builds outside the lock.
    /// </summary>
    [Fact]
    public async Task NoValidSnapshotUnderTheLock_Is503_AndTheNextTryBuildsOutsideTheLock()
    {
        using var client = api.CreateClient();
        var (world, round, phone) = await StreamAsync(api, client);
        api.AfterSnapshotWarmed = async (stream, _) =>
        {
            api.AfterSnapshotWarmed = null;
            await CourtCalls.ExecuteAsync(api.ConnectionString,
                "UPDATE matches.court_events SET event_id = @other WHERE court_session_id = @id AND position = 2",
                ("other", Guid.NewGuid()), ("id", stream));
        };
        var point = phone.Point("b");

        using (var refused = await CourtCalls.SendAsync(world, A.Scorekeeper, round, phone, [point]))
        {
            await AssertBusyAsync(refused);
        }

        Assert.Equal(2, await CourtCalls.EventCountAsync(api.ConnectionString, phone.CourtSessionId));
        Assert.Equal("built", await SnapshotOfWriteAsync(world, round, phone, point));
        Assert.Equal("hit", await SnapshotOfWriteAsync(world, round, phone, phone.Point("a")));
    }

    /// <summary>
    /// Condition 5: the COMMIT itself fails (a deferred constraint): the write is a 500 and its snapshot was never
    /// kept, so the same event goes in next on the snapshot of the committed events, with no build and no 503.
    /// </summary>
    [Fact]
    public async Task ACommitThatFails_KeepsNoSnapshotOfItsEvents()
    {
        using var client = api.CreateClient();
        var (world, round, phone) = await StreamAsync(api, client);
        var failing = Guid.NewGuid();
        var point = phone.Envelope(failing, "PointScored", $$"""{"matchId":"{{phone.MatchId}}","setNumber":1,"team":"b"}""");
        var trigger = $"refuse_commit_{failing:N}";
        await CourtCalls.ExecuteAsync(api.ConnectionString, $$"""
            CREATE FUNCTION matches.{{trigger}}() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'refused at commit by the test'; END $$;
            CREATE CONSTRAINT TRIGGER {{trigger}} AFTER INSERT ON matches.court_events DEFERRABLE INITIALLY DEFERRED
            FOR EACH ROW WHEN (NEW.event_id = '{{failing}}') EXECUTE FUNCTION matches.{{trigger}}();
            """);
        try
        {
            using var failed = await CourtCalls.SendAsync(world, A.Scorekeeper, round, phone, [point]);
            Assert.Equal(HttpStatusCode.InternalServerError, failed.StatusCode);
        }
        finally
        {
            await CourtCalls.ExecuteAsync(api.ConnectionString, $"DROP TRIGGER {trigger} ON matches.court_events; DROP FUNCTION matches.{trigger}();");
        }

        Assert.Equal(2, await CourtCalls.EventCountAsync(api.ConnectionString, phone.CourtSessionId));
        Assert.Equal("hit", await SnapshotOfWriteAsync(world, round, phone, point));
        Assert.Equal(3, await CourtCalls.EventCountAsync(api.ConnectionString, phone.CourtSessionId));
    }

    /// <summary>The stream's lock held elsewhere past <c>lock_timeout</c>: the write and the takeover are 503s, nothing written; then both go on.</summary>
    [Fact]
    public async Task TheLockHeldPastTheLockTimeout_IsA503_AndWritesNothing()
    {
        await using var shortLock = await RateLimitingTests.StartAsync(database, new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["CourtTransaction:LockTimeoutMilliseconds"] = ShortLockTimeout,
        });
        using var client = shortLock.CreateClient();
        var (world, round, phone) = await StreamAsync(shortLock, client);
        var other = phone.TakingOver(batch: 2);

        await using (var holder = new NpgsqlConnection(shortLock.ConnectionString))
        {
            await holder.OpenAsync(TestContext.Current.CancellationToken);
            await using var transaction = await holder.BeginTransactionAsync(TestContext.Current.CancellationToken);
            await using (var hold = new NpgsqlCommand("SELECT 1 FROM matches.court_sessions WHERE id = @id FOR UPDATE", holder, transaction))
            {
                _ = hold.Parameters.AddWithValue("id", phone.CourtSessionId);
                _ = await hold.ExecuteScalarAsync(TestContext.Current.CancellationToken);
            }

            using (var write = await CourtCalls.SendAsync(world, A.Scorekeeper, round, phone, [phone.Point("b")]))
            {
                await AssertBusyAsync(write);
            }

            using (var takeover = await CourtCalls.TakeOverAsync(world, A.Admin, round, other, expectedBatch: 1, expectedEventCount: 2))
            {
                await AssertBusyAsync(takeover);
            }

            await transaction.RollbackAsync(TestContext.Current.CancellationToken);
        }

        Assert.Equal(2, await CourtCalls.EventCountAsync(shortLock.ConnectionString, phone.CourtSessionId));
        Assert.Equal(1, await CourtCalls.CountAsync(shortLock.ConnectionString, "SELECT count(*) FROM matches.court_writers WHERE court_session_id = @id", phone.CourtSessionId));
        phone.ResumeAt(3);
        Assert.Equal((3L, 1), await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [phone.Point("b")]));
        Assert.Equal(2L, (await CourtCalls.TakenOverAsync(world, A.Admin, round, other, expectedBatch: 1, expectedEventCount: 3)).Batch);
    }

    /// <summary>One court-sync request of a person at a time (ADR 0081, Part 2): the second waits in the queue, the one past the queue is a 429.</summary>
    [Fact]
    public async Task CourtSyncOfOnePerson_RunsOneAtATime_AndPastTheQueueIs429()
    {
        await using var limited = await RateLimitingTests.StartAsync(database, new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["RateLimiting:CourtSyncPerUser"] = "1",
            ["RateLimiting:CourtSyncPerUserQueue"] = "1",
        });
        using var client = limited.CreateClient();
        var (world, round, phone) = await StreamAsync(limited, client);
        var inside = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var held = 0;
        limited.BeforeMembershipLookup = async _ =>
        {
            if (Interlocked.Exchange(ref held, 1) == 0)
            {
                inside.SetResult();
                await release.Task;
            }
        };
        try
        {
            var first = CourtCalls.SendAsync(world, A.Scorekeeper, round, phone, [phone.Point("b")]);
            await inside.Task.WaitAsync(TestContext.Current.CancellationToken);
            var queued = world.SendAsync(A.Scorekeeper, HttpMethod.Get, CourtCalls.SummaryPath(world, round));
            await Task.Delay(TimeSpan.FromMilliseconds(100), TestContext.Current.CancellationToken);
            using (var refused = await world.SendAsync(A.Scorekeeper, HttpMethod.Get, CourtCalls.SummaryPath(world, round)))
            {
                await RateLimitingTests.AssertRateLimitedAsync(refused);
            }

            Assert.False(queued.IsCompleted);
            release.SetResult();
            using var written = await first;
            using var read = await queued;
            Assert.Equal(HttpStatusCode.OK, written.StatusCode);
            Assert.Equal(HttpStatusCode.OK, read.StatusCode);
        }
        finally
        {
            release.TrySetResult();
            limited.BeforeMembershipLookup = null;
        }
    }

    /// <summary>
    /// M5-M2: a round already closed answers its instant again without summarizing the court: with a stored row the
    /// parser refuses added after the first close, any summary would be a 500.
    /// </summary>
    [Fact]
    public async Task ClosingAClosedRoundAgain_NeverSummarizesTheCourt()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone,
            [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]), phone.Point("a"), phone.ManualEnd("a")]);
        var first = await CloseAsync(world, round);
        await CourtCalls.ExecuteAsync(api.ConnectionString,
            """
            INSERT INTO matches.court_events (court_session_id, position, event_id, batch, sequence, device_id, schema_version, type, envelope, received_at)
            VALUES (@id, 4, @eventId, 1, 4, @deviceId, 1, 'PointScored', '{"not":"an envelope"}', now());
            UPDATE matches.court_sessions SET event_count = 4 WHERE id = @id;
            """,
            ("id", phone.CourtSessionId), ("eventId", Guid.NewGuid()), ("deviceId", phone.DeviceId));

        var again = await CloseAsync(world, round);

        Assert.Equal(first["closedAt"]!.GetValue<DateTimeOffset>(), again["closedAt"]!.GetValue<DateTimeOffset>());
    }

    private static async Task<(GroupWorld World, string Round, CourtPhone Phone)> StreamAsync(ApiWithDatabase host, HttpClient client)
    {
        var world = await GroupWorld.CreateAsync(host, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]), phone.Point("a")]);
        return (world, round, phone);
    }

    private static async Task<JsonObject> CloseAsync(GroupWorld world, string round)
    {
        using var closed = await world.SendAsync(A.Admin, HttpMethod.Post, RoundCalls.RoundPath(world, round) + "/close");
        var body = await closed.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Assert.True(closed.StatusCode == HttpStatusCode.OK, body);
        return JsonNode.Parse(body)!.AsObject();
    }

    private static async Task AssertBusyAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("2", response.Headers.GetValues("Retry-After").Single());
        Assert.Equal(CourtBusy, await RoundCalls.CodeAsync(response));
    }

    private async Task<string> SnapshotOfWriteAsync(GroupWorld world, string round, CourtPhone phone, string envelope)
    {
        var before = api.Logs.Count;
        var stored = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [envelope]);
        Assert.Equal(1, stored.Stored);
        return api.Logs.EntriesSince(before).Select(entry => StoredLine().Match(entry)).Single(match => match.Success).Groups["snapshot"].Value;
    }

    [GeneratedRegex(@"Court events stored\..*snapshot (?<snapshot>[a-z-]+)\.")]
    private static partial Regex StoredLine();
}
