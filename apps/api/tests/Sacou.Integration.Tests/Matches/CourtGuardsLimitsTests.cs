using System.Net;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.RateLimiting;
using Sacou.Integration.Tests.Sessions;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Matches;

/// <summary>Extra proofs of the court guards (ADR 0081, Part 2): the shared court-sync queue across users and the statement timeout as a 503.</summary>
public sealed class CourtGuardsLimitsTests(IntegrationDatabase database)
{
    private const int SharedConcurrency = 3;

    /// <summary>The shared gate holds the users of the court-sync routes together: past its permits the next user of another account waits, then runs.</summary>
    [Fact]
    public async Task CourtSyncOfDifferentUsers_PastTheSharedConcurrency_WaitsForATurn()
    {
        await using var limited = await RateLimitingTests.StartAsync(database, new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["RateLimiting:CourtSyncConcurrency"] = SharedConcurrency.ToString(System.Globalization.CultureInfo.InvariantCulture),
            ["RateLimiting:CourtSyncQueue"] = "4",
        });
        using var client = limited.CreateClient();
        var world = await GroupWorld.CreateAsync(limited, client);
        var round = await CourtCalls.RoundAsync(world);
        var users = new[] { A.Admin, A.CoAdmin, A.Scorekeeper, A.Player };
        var entered = 0;
        var allInside = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        limited.BeforeMembershipLookup = async _ =>
        {
            if (Interlocked.Increment(ref entered) == SharedConcurrency)
            {
                allInside.SetResult();
            }

            await release.Task;
        };
        try
        {
            var calls = users.Select(user => world.SendAsync(user, HttpMethod.Get, CourtCalls.SummaryPath(world, round))).ToList();
            await allInside.Task.WaitAsync(TestContext.Current.CancellationToken);
            await Task.Delay(TimeSpan.FromMilliseconds(300), TestContext.Current.CancellationToken);

            Assert.Equal(SharedConcurrency, Volatile.Read(ref entered));
            release.SetResult();
            foreach (var call in calls)
            {
                using var response = await call;
                Assert.NotEqual(HttpStatusCode.TooManyRequests, response.StatusCode);
                Assert.NotEqual(HttpStatusCode.InternalServerError, response.StatusCode);
            }

            Assert.Equal(users.Length, Volatile.Read(ref entered));
        }
        finally
        {
            release.TrySetResult();
            limited.BeforeMembershipLookup = null;
        }
    }

    /// <summary>A statement past <c>statement_timeout</c> (SQLSTATE 57014) is a 503 matches.court-busy, never a 500, and writes nothing.</summary>
    [Fact]
    public async Task AStatementPastTheStatementTimeout_IsA503CourtBusy_AndWritesNothing()
    {
        await using var shortStatement = await RateLimitingTests.StartAsync(database, new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["CourtTransaction:StatementTimeoutMilliseconds"] = "300",
        });
        using var client = shortStatement.CreateClient();
        var world = await GroupWorld.CreateAsync(shortStatement, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone,
            [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]), phone.Point("a")]);
        var slow = Guid.NewGuid();
        var point = phone.Envelope(slow, "PointScored", $$"""{"matchId":"{{phone.MatchId}}","setNumber":1,"team":"b"}""");
        var trigger = $"slow_insert_{slow:N}";
        await CourtCalls.ExecuteAsync(shortStatement.ConnectionString, $$"""
            CREATE FUNCTION matches.{{trigger}}() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN PERFORM pg_sleep(3); RETURN NEW; END $$;
            CREATE TRIGGER {{trigger}} BEFORE INSERT ON matches.court_events
            FOR EACH ROW WHEN (NEW.event_id = '{{slow}}') EXECUTE FUNCTION matches.{{trigger}}();
            """);
        try
        {
            using var response = await CourtCalls.SendAsync(world, A.Scorekeeper, round, phone, [point]);
            Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
            Assert.Equal("matches.court-busy", await RoundCalls.CodeAsync(response));
        }
        finally
        {
            await CourtCalls.ExecuteAsync(shortStatement.ConnectionString, $"DROP TRIGGER {trigger} ON matches.court_events; DROP FUNCTION matches.{trigger}();");
        }

        Assert.Equal(2, await CourtCalls.EventCountAsync(shortStatement.ConnectionString, phone.CourtSessionId));
        phone.ResumeAt(3);
        Assert.Equal((3L, 1), await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [phone.Point("b")]));
    }

    /// <summary>
    /// Under the lock, a snapshot more than a small build behind the stream is never replayed there: the write is a 503
    /// with nothing stored, and its next try (warmed outside the lock) is accepted.
    /// </summary>
    [Fact]
    public async Task ASnapshotMoreThanASmallBuildBehindUnderTheLock_Is503_NeverReplayedThere()
    {
        await using var small = await RateLimitingTests.StartAsync(database, new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["CourtStreamCache:SmallStreamEvents"] = "200",
        });
        using var client = small.CreateClient();
        var world = await GroupWorld.CreateAsync(small, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone,
            [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]), phone.Point("a")]);
        const int outerSequence = 204;
        phone.ResumeAt(outerSequence);
        var outer = phone.Point("b");
        small.AfterSnapshotWarmed = async (_, _) =>
        {
            small.AfterSnapshotWarmed = null;
            phone.ResumeAt(3);
            foreach (var size in new[] { 100, 100, 1 })
            {
                _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, Enumerable.Range(0, size).Select(index => phone.Point(index % 2 == 0 ? "b" : "a")).ToList());
            }
        };
        try
        {
            using var refused = await CourtCalls.SendAsync(world, A.Scorekeeper, round, phone, [outer]);
            Assert.Equal(HttpStatusCode.ServiceUnavailable, refused.StatusCode);
            Assert.Equal("matches.court-busy", await RoundCalls.CodeAsync(refused));
        }
        finally
        {
            small.AfterSnapshotWarmed = null;
        }

        Assert.Equal(203, await CourtCalls.EventCountAsync(small.ConnectionString, phone.CourtSessionId));
        phone.ResumeAt(outerSequence);
        Assert.Equal((outerSequence, 1), await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [phone.Point("b")]));
    }
}
