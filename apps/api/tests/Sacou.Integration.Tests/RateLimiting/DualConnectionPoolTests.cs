using System.Net;
using Microsoft.Extensions.Options;
using Sacou.Integration.Tests.Groups;
using Xunit;

namespace Sacou.Integration.Tests.RateLimiting;

/// <summary>
/// Case 14 of E5.3a, the scenario of M3-M1: creating a group and accepting an invite hold two connections at once
/// (ADR 0056, D7a). With a pool of six, twelve people creating and twelve accepting at the same time all finish, with
/// no 500 and no pool timeout, because the shared concurrency limit lets only one such request run (ADR 0062, D4).
/// </summary>
public sealed class DualConnectionPoolTests(IntegrationDatabase database)
{
    private const int People = 12;
    private const int SmallPool = 6;
    private const int PoolWaitSeconds = 3;
    private static readonly TimeSpan Deadline = TimeSpan.FromSeconds(60);

    /// <summary>
    /// A smoke test, not a proof: the requests are not held after the lock (the C4/C5 hook of
    /// <see cref="ApiWithDatabase.AfterCurrentUserResolved"/> runs once and before the transaction), so on a fast machine
    /// they may never overlap inside the two connections. It shows the limit lets every request through on a small pool;
    /// the bound itself is proven by the start check (<see cref="ConcurrencyThatDoesNotFitThePool_StopsTheStart"/>) and
    /// the limiter tests of <c>Sacou.Http.Tests</c>.
    /// </summary>
    [Fact]
    public async Task Smoke_SimultaneousTwoConnectionRequests_AllFinishOnTheSmallPool()
    {
        await using var api = await StartAsync(new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["RateLimiting:DualConnectionConcurrency"] = "1",
            ["RateLimiting:DualConnectionHeadroom"] = "2",
            // The court-sync routes take two connections each of the pool check too (ADR 0081, Part 2): 2 × (1 + 1) + 2 = 6.
            ["RateLimiting:CourtSyncConcurrency"] = "1",
            ["RateLimiting:DualConnectionQueue"] = "64",
        });

        var statuses = await RaceAsync(api);

        // The queue holds every waiting request, so all of them run, one at a time: none is refused, none fails.
        Assert.Equal(2 * People, statuses.Length);
        Assert.All(statuses, status => Assert.Contains(status, new[] { HttpStatusCode.Created, HttpStatusCode.OK }));
    }

    /// <summary>
    /// The control: the configuration that would let the race run out of the pool (the initial concurrency of 8 on a
    /// pool of 6) never starts. A race without the limit is not run here: whether it exhausts the pool depends on the
    /// machine's timing, so it would be a flaky test.
    /// </summary>
    [Fact]
    public async Task ConcurrencyThatDoesNotFitThePool_StopsTheStart()
    {
        await using var api = new ApiWithDatabase(database, new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["ConnectionStrings:Sacou"] = $"{database.ConnectionString};Maximum Pool Size={SmallPool}",
        });

        var failure = Record.Exception(() => api.Services);

        var refusal = Assert.IsType<OptionsValidationException>(Innermost(failure), exactMatch: false);
        Assert.Contains("Maximum Pool Size", refusal.Message, StringComparison.Ordinal);
        Assert.DoesNotContain(database.ConnectionString, refusal.Message, StringComparison.Ordinal);
    }

    private static Exception? Innermost(Exception? failure)
    {
        var current = failure;
        while (current is not null and not OptionsValidationException && current.InnerException is not null)
        {
            current = current.InnerException;
        }

        return current;
    }

    private async Task<ApiWithDatabase> StartAsync(Dictionary<string, string?> settings)
    {
        settings["ConnectionStrings:Sacou"] = $"{database.ConnectionString};Maximum Pool Size={SmallPool};Timeout={PoolWaitSeconds}";
        var api = new ApiWithDatabase(database, settings);
        await api.MigrateAsync();
        return api;
    }

    /// <summary>Twelve new people create a group and twelve others accept one invite, all released together by one signal.</summary>
    private static async Task<HttpStatusCode[]> RaceAsync(ApiWithDatabase api)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var body = GroupWorld.TokenBody(world.Invite.Token);
        var creators = await RegisterAsync(api, client);
        var joiners = await RegisterAsync(api, client);
        var calls = creators.Select(subject => (Subject: subject, Path: GroupWorld.GroupsPath, Body: """{"name":"Racha da corrida"}"""))
            .Concat(joiners.Select(subject => (Subject: subject, Path: GroupWorld.AcceptPath, Body: body)))
            .ToList();

        var start = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var race = calls.Select(async call =>
        {
            await start.Task.WaitAsync(TestContext.Current.CancellationToken);
            using var response = await RateLimitingTests.SendAsync(api, client, call.Subject, HttpMethod.Post, call.Path, call.Body);
            return response.StatusCode;
        }).ToList();
        start.SetResult();
        return await Task.WhenAll(race).WaitAsync(Deadline, TestContext.Current.CancellationToken);
    }

    private static async Task<List<string>> RegisterAsync(ApiWithDatabase api, HttpClient client)
    {
        var subjects = Enumerable.Range(0, People).Select(_ => RateLimitingTests.NewSubject()).ToList();
        foreach (var subject in subjects)
        {
            _ = await RateLimitingTests.RegisterAsync(api, client, subject);
        }

        return subjects;
    }
}
