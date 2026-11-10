using System.Net;
using System.Text.Json.Nodes;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Groups;

/// <summary>
/// C1 to C3 of E3.3: the writes of one group's settings run one after another (the lock on its settings row), so
/// no change is lost and the template ceiling holds. Each round is a new group; the calls leave a barrier together.
/// </summary>
public sealed class GroupSettingsConcurrencyTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int Rounds = 5;
    private const int CeilingMinusOne = 19;
    private const string PatchBestOf =
        """{"settings":{"schemaVersion":1,"scoring":{"bestOf":3}}}""";
    private const string PatchPointsAndVenue =
        """{"settings":{"schemaVersion":1,"scoring":{"pointsPerSet":21},"schedule":{"venue":"Areia"}}}""";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>C1: two patches on different blocks; both values stay, none is lost to the other's read.</summary>
    [Fact]
    public async Task TwoPatchesOnDifferentLeaves_KeepBothChanges()
    {
        for (var round = 0; round < Rounds; round++)
        {
            using var client = api.CreateClient();
            var world = await GroupWorld.CreateAsync(api, client);

            var statuses = await RaceAsync(
                world,
                (A.Admin, HttpMethod.Patch, "/settings", PatchBestOf),
                (A.CoAdmin, HttpMethod.Patch, "/settings", PatchPointsAndVenue));
            var settings = (await SettingsCalls.GetAsync(world, world.GroupPath))["settings"]!;

            Assert.All(statuses, status => Assert.Equal(HttpStatusCode.OK, status));
            Assert.Equal(3, settings["scoring"]!["bestOf"]!.GetValue<int>());
            Assert.Equal(21, settings["scoring"]!["pointsPerSet"]!.GetValue<int>());
            Assert.Equal("Areia", settings["schedule"]!["venue"]!.GetValue<string>());
        }
    }

    /// <summary>C2: a patch and "apply template" together end as one of the two orders, never a mix.</summary>
    [Fact]
    public async Task PatchAndApplyTemplate_EndAsOneOfTheTwoOrders()
    {
        for (var round = 0; round < Rounds; round++)
        {
            using var client = api.CreateClient();
            var world = await GroupWorld.CreateAsync(api, client);
            var treino = SettingsCalls.Document(await SettingsCalls.ApplyAsync(world, world.GroupPath, """{"templateKey":"treino"}"""));
            await SettingsCalls.ApplyAsync(world, world.GroupPath, """{"templateKey":"do-zero"}""");

            var statuses = await RaceAsync(
                world,
                (A.Admin, HttpMethod.Patch, "/settings", PatchBestOf),
                (A.CoAdmin, HttpMethod.Post, "/settings/apply-template", """{"templateKey":"treino"}"""));
            var final = SettingsCalls.Document(await SettingsCalls.GetAsync(world, world.GroupPath));

            Assert.All(statuses, status => Assert.Equal(HttpStatusCode.OK, status));
            var applyThenPatch = treino.DeepClone();
            applyThenPatch["scoring"]!["bestOf"] = 3;
            Assert.True(JsonNode.DeepEquals(final, treino) || JsonNode.DeepEquals(final, applyThenPatch));
        }
    }

    /// <summary>C3: five saves at once with 19 saved; exactly one fits under the ceiling of 20.</summary>
    [Fact]
    public async Task FiveSavesWithNineteenSaved_LeaveExactlyOneRoom()
    {
        for (var round = 0; round < Rounds; round++)
        {
            using var client = api.CreateClient();
            var world = await GroupWorld.CreateAsync(api, client);
            for (var index = 0; index < CeilingMinusOne; index++)
            {
                await SettingsCalls.SaveAsync(world, world.GroupPath, $"Modelo {index}");
            }

            var statuses = await RaceAsync(world, [.. Enumerable.Range(0, 5).Select(index =>
                (A.Admin, HttpMethod.Post, "/templates", $$"""{"name":"Corrida {{index}}"}"""))]);

            Assert.Single(statuses, status => status == HttpStatusCode.Created);
            Assert.Equal(4, statuses.Count(status => status == HttpStatusCode.Conflict));
            Assert.Equal(20, (await SettingsCalls.ListAsync(world, world.GroupPath)).Count);
        }
    }

    private static async Task<HttpStatusCode[]> RaceAsync(GroupWorld world, params (A Actor, HttpMethod Method, string Route, string Json)[] calls)
    {
        using var gate = new Barrier(calls.Length);
        var tasks = calls.Select(async call =>
        {
            await Task.Yield();
            gate.SignalAndWait(TestContext.Current.CancellationToken);
            using var response = await world.SendAsync(call.Actor, call.Method, world.GroupPath + call.Route, call.Json);
            return response.StatusCode;
        });
        return await Task.WhenAll(tasks);
    }
}
