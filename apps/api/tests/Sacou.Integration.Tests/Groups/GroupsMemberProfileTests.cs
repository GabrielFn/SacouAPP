using System.Net;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Sacou.Integration.Tests.Identity;
using Sacou.Modules.Identity.Contracts;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Groups;

/// <summary>P1 of E3.17 (member list): the nickname and positions of each member, and no level for any role.</summary>
public sealed class GroupsMemberProfileTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string LevelWord = "level";
    private const string MarkerLevel = "4.5";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task MemberWithAProfile_ShowsIt_AndOneWithoutShowsNulls()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        using var saved = await world.SendAsync(A.Player, HttpMethod.Put, ProfileRows.ProfilePath,
            ProfileRows.Body(nickname: "Caio", primary: "\"middleBlocker\"", others: "[\"opposite\",\"setter\"]"));

        var members = await MembersAsync(world, A.Admin);

        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var player = members[world.MemberIds[A.Player]];
        Assert.Equal("Caio", player["nickname"]!.GetValue<string>());
        Assert.Equal("middleBlocker", player["primaryPosition"]!.GetValue<string>());
        Assert.Equal("""["setter","opposite"]""", player["otherPositions"]!.ToJsonString());
        var admin = members[world.MemberIds[A.Admin]];
        Assert.Null(admin["nickname"]);
        Assert.Null(admin["primaryPosition"]);
        Assert.Equal("[]", admin["otherPositions"]!.ToJsonString());
        Assert.True(admin.ContainsKey("nickname"));
        Assert.True(admin.ContainsKey("primaryPosition"));
    }

    /// <summary>One profile per person: a new nickname shows in every group the person is in.</summary>
    [Fact]
    public async Task ProfileChange_ShowsInEveryGroup()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var second = await world.CreateGroupAsync(A.Player, "Segundo racha");
        using var first = await world.SendAsync(A.Player, HttpMethod.Put, ProfileRows.ProfilePath, ProfileRows.Body(nickname: "Caio"));
        using var changed = await world.SendAsync(A.Player, HttpMethod.Put, ProfileRows.ProfilePath, ProfileRows.Body(nickname: "Caião"));

        var here = await MembersAsync(world, A.Admin);
        using var there = await world.SendAsync(A.Player, HttpMethod.Get, $"{GroupWorld.GroupsPath}/{second}/members");
        var thereMembers = JsonNode.Parse(await there.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!.AsArray();

        Assert.Equal("Caião", here[world.MemberIds[A.Player]]["nickname"]!.GetValue<string>());
        Assert.Equal("Caião", Assert.Single(thereMembers)!["nickname"]!.GetValue<string>());
    }

    /// <summary>D7: the player's suggestion (4.5) never shows in the list, for any role, under any name.</summary>
    [Theory]
    [InlineData(A.Admin)]
    [InlineData(A.CoAdmin)]
    [InlineData(A.Scorekeeper)]
    [InlineData(A.Player)]
    public async Task List_NeverCarriesALevel(A reader)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        using var saved = await world.SendAsync(A.Player, HttpMethod.Put, ProfileRows.ProfilePath, ProfileRows.Body(level: MarkerLevel));

        using var response = await world.SendAsync(reader, HttpMethod.Get, world.GroupPath + "/members");
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        var members = JsonNode.Parse(text)!.AsArray().Select(member => member!.AsObject()).ToList();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(members, member => member["nickname"]?.GetValue<string>() == "Caio");
        Assert.All(members, member => Assert.DoesNotContain(member, field => field.Key.Contains(LevelWord, StringComparison.OrdinalIgnoreCase)));
        // As a JSON value (":4.5"): the bare "4.5" also matches a timestamp such as "44.58", which flaked the test.
        Assert.DoesNotContain(":" + MarkerLevel, text, StringComparison.Ordinal);
    }

    /// <summary>No N+1: the list asks Identity once, for every member at once, whatever the size of the group.</summary>
    [Fact]
    public async Task List_AsksForTheProfilesOnce()
    {
        var counter = new CallCounter();
        await using var counted = api.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            var original = services.Last(service => service.ServiceType == typeof(IPlayerProfiles));
            services.AddScoped<IPlayerProfiles>(provider => new CountingProfiles(
                (IPlayerProfiles)ActivatorUtilities.CreateInstance(provider, original.ImplementationType!), counter));
        }));
        using var client = counted.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await world.AddMemberAsync("player");
        await world.AddMemberAsync("player");

        using var response = await world.SendAsync(A.Admin, HttpMethod.Get, world.GroupPath + "/members");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, counter.Calls);
        Assert.Equal(6, counter.LastRequested);
    }

    private static async Task<Dictionary<Guid, JsonObject>> MembersAsync(GroupWorld world, A reader)
    {
        using var response = await world.SendAsync(reader, HttpMethod.Get, world.GroupPath + "/members");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonNode.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!.AsArray()
            .Select(member => member!.AsObject())
            .ToDictionary(member => member["memberId"]!.GetValue<Guid>());
    }

    private sealed class CallCounter
    {
        public int Calls { get; set; }

        public int LastRequested { get; set; }
    }

    private sealed class CountingProfiles(IPlayerProfiles inner, CallCounter counter) : IPlayerProfiles
    {
        public Task<IReadOnlyList<PlayerProfileView>> FindManyAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken)
        {
            counter.Calls++;
            counter.LastRequested = userIds.Count;
            return inner.FindManyAsync(userIds, cancellationToken);
        }
    }
}
