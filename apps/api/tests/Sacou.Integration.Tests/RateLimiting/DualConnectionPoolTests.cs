using System.Net;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Sacou.Http.RateLimiting;
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

    [Fact]
    public async Task SimultaneousTwoConnectionRequests_NeverExhaustTheSmallPool()
    {
        await using var api = await StartAsync(new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["RateLimiting:DualConnectionConcurrency"] = "1",
            ["RateLimiting:DualConnectionHeadroom"] = "4",
            ["RateLimiting:DualConnectionQueue"] = "64",
        });

        var statuses = await RaceAsync(api);

        // The queue holds every waiting request, so all of them run, one at a time: none is refused, none fails.
        Assert.Equal(2 * People, statuses.Length);
        Assert.All(statuses, status => Assert.Contains(status, new[] { HttpStatusCode.Created, HttpStatusCode.OK }));
    }

    /// <summary>
    /// The control: the same race with the concurrency limit out of the way (and the start check that forbids it
    /// dropped) runs out of the pool, and some request fails. This is the failure the limit prevents.
    /// </summary>
    [Fact]
    public async Task WithoutTheLimit_TheSameRaceRunsOutOfThePool()
    {
        await using var api = await StartAsync(
            new Dictionary<string, string?>(StringComparer.Ordinal) { ["RateLimiting:DualConnectionConcurrency"] = "1000" },
            dropStartChecks: true);

        var statuses = await RaceAsync(api);

        Assert.Contains(statuses, status => (int)status >= (int)HttpStatusCode.InternalServerError);
    }

    private async Task<ApiWithDatabase> StartAsync(Dictionary<string, string?> settings, bool dropStartChecks = false)
    {
        settings["ConnectionStrings:Sacou"] = $"{database.ConnectionString};Maximum Pool Size={SmallPool};Timeout={PoolWaitSeconds}";
        var api = new ApiWithDatabase(database, settings)
        {
            MoreServices = dropStartChecks ? services => services.RemoveAll<IValidateOptions<RateLimitingOptions>>() : null,
        };
        await api.MigrateAsync();
        return api;
    }

    /// <summary>Twelve new people create a group and twelve others accept one invite, all released by one barrier.</summary>
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

        using var gate = new Barrier(calls.Count);
        var race = calls.Select(async call =>
        {
            await Task.Yield();
            gate.SignalAndWait(TestContext.Current.CancellationToken);
            using var response = await RateLimitingTests.SendAsync(api, client, call.Subject, HttpMethod.Post, call.Path, call.Body);
            return response.StatusCode;
        });
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
