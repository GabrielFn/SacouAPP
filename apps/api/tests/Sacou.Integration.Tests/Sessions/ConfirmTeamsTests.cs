using System.Net;
using System.Text.Json.Nodes;
using Sacou.Integration.Tests.Groups;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Sessions;

/// <summary>
/// Cases 9 to 14 of the R100 plan on the real API and a real Postgres (ADR 0078): who publishes the teams, who reads
/// them, what the answers never carry, and the refusals.
/// </summary>
public sealed class ConfirmTeamsTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int TeamOfSix = 6;
    private const int ScreenSevenExtras = 10;
    private const string TeamsInvalid = "sessions.round-teams-invalid";

    /// <summary>What must never leave the server next to the teams: the admin's note, the meter and the seed.</summary>
    private static readonly string[] PrivateWords = ["level", "average", "difference", "seed"];

    /// <summary>The same, in the whole round: its settings already name "balanceByLevel", which is no note.</summary>
    private static readonly string[] PrivateFields = ["levelTenths", "averageTenths", "differenceTenths", "seed"];

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    private static string TeamsPath(GroupWorld world, string roundId) => RoundCalls.RoundPath(world, roundId) + "/teams";

    /// <summary>G1: 14 confirmed, Laranja the first six, Azul the next six, the last two in the queue.</summary>
    private static string G1Body(IReadOnlyList<Guid> members) => Body(
        [members.Take(TeamOfSix), members.Skip(TeamOfSix).Take(TeamOfSix)], members.Skip(TeamOfSix * 2));

    private static string Body(IEnumerable<IEnumerable<Guid>> teams, IEnumerable<Guid> reserves) =>
        new JsonObject
        {
            ["teams"] = new JsonArray([.. teams.Select(team => (JsonNode)new JsonArray([.. team.Select(id => (JsonNode)JsonValue.Create(id))]))]),
            ["reserves"] = new JsonArray([.. reserves.Select(id => (JsonNode)JsonValue.Create(id))]),
        }.ToJsonString();

    private static async Task<HttpResponseMessage> PutAsync(GroupWorld world, string roundId, string body, A actor = A.Admin) =>
        await world.SendAsync(actor, HttpMethod.Put, TeamsPath(world, roundId), body);

    private async Task<(GroupWorld World, string Round, IReadOnlyList<Guid> Members)> G1Async(HttpClient client)
    {
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await DrawCalls.RoundAsync(world);
        var members = await DrawCalls.ConfirmPlayersAsync(world, round, ScreenSevenExtras);
        return (world, round, members);
    }

    private static IReadOnlyList<IReadOnlyList<Guid>> TeamsOf(JsonObject round) =>
        [.. round["teams"]!["teams"]!.AsArray().Select(team => (IReadOnlyList<Guid>)[.. team!["memberIds"]!.AsArray().Select(id => id!.GetValue<Guid>())])];

    private static void AssertNoNote(string json)
    {
        foreach (var field in PrivateFields)
        {
            Assert.DoesNotContain(field, json, StringComparison.OrdinalIgnoreCase);
        }

        var teams = JsonNode.Parse(json)!["teams"]!.ToJsonString();
        foreach (var word in PrivateWords)
        {
            Assert.DoesNotContain(word, teams, StringComparison.OrdinalIgnoreCase);
        }
    }

    /// <summary>Case 9: the admin and the co-admin publish; the player and the scorekeeper read the same ids in the same order.</summary>
    [Theory]
    [InlineData(A.Admin)]
    [InlineData(A.CoAdmin)]
    public async Task Case9_AdminAndCoAdmin_Publish_AndEveryMemberReadsTheSameTeams(A actor)
    {
        using var client = api.CreateClient();
        var (world, round, members) = await G1Async(client);
        var before = await RoundCalls.GetAsync(world, round, A.Player);

        using var response = await PutAsync(world, round, G1Body(members), actor);

        Assert.Null(before["teams"]);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var written = await RoundCalls.JsonAsync(response);
        Assert.Equal(members.Take(TeamOfSix), TeamsOf(written)[0]);
        foreach (var reader in new[] { A.Player, A.Scorekeeper })
        {
            var read = await RoundCalls.GetAsync(world, round, reader);
            Assert.Equal(TeamsOf(written), TeamsOf(read));
            Assert.Equal([1, 2], read["teams"]!["teams"]!.AsArray().Select(team => team!["number"]!.GetValue<int>()));
            Assert.Equal(members.Skip(TeamOfSix * 2), read["teams"]!["reserves"]!.AsArray().Select(id => id!.GetValue<Guid>()));
            Assert.Equal(["confirmedAt", "teams", "reserves"], read["teams"]!.AsObject().Select(field => field.Key));
        }
    }

    /// <summary>Case 9: a second confirmation replaces the first whole.</summary>
    [Fact]
    public async Task Case9_ASecondConfirmation_ReplacesTheTeams()
    {
        using var client = api.CreateClient();
        var (world, round, members) = await G1Async(client);
        using var first = await PutAsync(world, round, G1Body(members));
        var swapped = members.Reverse().ToList();

        using var second = await PutAsync(world, round, Body([swapped.Take(TeamOfSix), swapped.Skip(TeamOfSix).Take(TeamOfSix)], []));

        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        var read = await RoundCalls.GetAsync(world, round, A.Player);
        Assert.Equal(swapped.Take(TeamOfSix), TeamsOf(read)[0]);
        Assert.Empty(read["teams"]!["reserves"]!.AsArray());
        Assert.True(read["teams"]!["confirmedAt"]!.GetValue<DateTimeOffset>() > (await RoundCalls.JsonAsync(first))["teams"]!["confirmedAt"]!.GetValue<DateTimeOffset>());
    }

    /// <summary>Case 10: only who draws publishes; the rest gets the refusals of the draw, all no-store.</summary>
    [Theory]
    [InlineData(A.Scorekeeper, HttpStatusCode.Forbidden, RoundCalls.Forbidden)]
    [InlineData(A.Player, HttpStatusCode.Forbidden, RoundCalls.Forbidden)]
    [InlineData(A.RemovedMember, HttpStatusCode.NotFound, RoundCalls.GroupNotFound)]
    [InlineData(A.NonMember, HttpStatusCode.NotFound, RoundCalls.GroupNotFound)]
    [InlineData(A.Anonymous, HttpStatusCode.Unauthorized, null)]
    public async Task Case10_OtherActors_CannotPublish(A actor, HttpStatusCode status, string? code)
    {
        using var client = api.CreateClient();
        var (world, round, members) = await G1Async(client);

        using var response = await PutAsync(world, round, G1Body(members), actor);

        Assert.Equal(status, response.StatusCode);
        Assert.Equal(code, await RoundCalls.CodeAsync(response));
        Assert.Equal(DrawCalls.NoStore, response.Headers.CacheControl?.ToString());
        Assert.Null((await RoundCalls.GetAsync(world, round, A.Player))["teams"]);
    }

    /// <summary>Case 10: who is not a member reads the teams nowhere: the read of the round refuses them as before.</summary>
    [Theory]
    [InlineData(A.RemovedMember)]
    [InlineData(A.NonMember)]
    public async Task Case10_NonMembers_CannotReadTheTeams(A actor)
    {
        using var client = api.CreateClient();
        var (world, round, members) = await G1Async(client);
        using var published = await PutAsync(world, round, G1Body(members));

        using var response = await world.SendAsync(actor, HttpMethod.Get, RoundCalls.RoundPath(world, round));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(RoundCalls.GroupNotFound, await RoundCalls.CodeAsync(response));
    }

    /// <summary>Case 10: a round of group B through group A's route is not found, and a member of B is not a player of A.</summary>
    [Fact]
    public async Task Case10_AnotherGroup_IsNotFound_OrInvalid()
    {
        using var client = api.CreateClient();
        var a = await GroupWorld.CreateAsync(api, client, "Racha A");
        var b = await GroupWorld.CreateAsync(api, client, "Racha B");
        var roundA = await DrawCalls.RoundAsync(a);
        var membersA = await DrawCalls.ConfirmPlayersAsync(a, roundA, ScreenSevenExtras);
        var roundB = await DrawCalls.RoundAsync(b);
        var membersB = await DrawCalls.ConfirmPlayersAsync(b, roundB, ScreenSevenExtras);

        using var crossed = await a.SendAsync(A.Admin, HttpMethod.Put, TeamsPath(a, roundB), G1Body(membersB));
        using var foreign = await PutAsync(a, roundA, G1Body([.. membersA.Take(TeamOfSix), .. membersB.Take(TeamOfSix)]));

        Assert.Equal(HttpStatusCode.NotFound, crossed.StatusCode);
        Assert.Equal("sessions.round-not-found", await RoundCalls.CodeAsync(crossed));
        Assert.Equal(HttpStatusCode.BadRequest, foreign.StatusCode);
        Assert.Equal(TeamsInvalid, await RoundCalls.CodeAsync(foreign));
    }

    /// <summary>Case 11: neither the answer of the write nor the read carry a note, a meter or a seed; a level in the body is a 400.</summary>
    [Fact]
    public async Task Case11_NoNoteAnywhere_AndALevelInTheBody_IsRefused()
    {
        using var client = api.CreateClient();
        var (world, round, members) = await G1Async(client);
        var leveled = G1Body(members).Replace("\"reserves\"", "\"levelTenths\":[35],\"reserves\"", StringComparison.Ordinal);

        using var written = await PutAsync(world, round, G1Body(members));
        using var read = await world.SendAsync(A.Player, HttpMethod.Get, RoundCalls.RoundPath(world, round));
        using var refused = await PutAsync(world, round, leveled);

        AssertNoNote(await written.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        AssertNoNote(await read.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
        Assert.Equal(DrawCalls.NoStore, refused.Headers.CacheControl?.ToString());
    }

    /// <summary>Case 11: a member as an object (with a level) instead of an id is a 400 too, and so is a missing list of reserves.</summary>
    [Theory]
    [InlineData("""{"teams":[[{"memberId":"00000000-0000-0000-0000-000000000001","levelTenths":35}]],"reserves":[]}""")]
    [InlineData("""{"teams":[]}""")]
    [InlineData("""{"reserves":[]}""")]
    [InlineData("""{"teams":null,"reserves":[]}""")]
    [InlineData("""{"teams":[null,null],"reserves":[]}""")]
    public async Task Case11_MalformedBodies_AreRefused(string body)
    {
        using var client = api.CreateClient();
        var (world, round, _) = await G1Async(client);

        using var response = await PutAsync(world, round, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    /// <summary>Case 11: the domain's refusals reach the app as the stable code.</summary>
    [Fact]
    public async Task Case11_UnequalTeams_AreTeamsInvalid()
    {
        using var client = api.CreateClient();
        var (world, round, members) = await G1Async(client);

        using var response = await PutAsync(world, round, Body([members.Take(TeamOfSix), members.Skip(TeamOfSix).Take(TeamOfSix - 1)], []));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(TeamsInvalid, await RoundCalls.CodeAsync(response));
    }

    /// <summary>Case 12: the list of rounds and the web page carry no teams.</summary>
    [Fact]
    public async Task Case12_TheListAndTheWebPage_HaveNoTeams()
    {
        using var client = api.CreateClient();
        var (world, round, members) = await G1Async(client);
        using var published = await PutAsync(world, round, G1Body(members));
        var code = RoundLinkCalls.CodeOf(await RoundCalls.GetAsync(world, round));

        using var list = await world.SendAsync(A.Player, HttpMethod.Get, RoundCalls.RoundsPath(world));
        using var page = await client.GetAsync($"/r/{code}", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        Assert.All(await RoundCalls.JsonAsyncArray(list), item => Assert.Null(item!["teams"]));
        Assert.DoesNotContain("Laranja", await page.Content.ReadAsStringAsync(TestContext.Current.CancellationToken), StringComparison.Ordinal);
    }

    /// <summary>Case 13: a member removed after the teams stays in them, by id; nothing changes the teams on its own.</summary>
    [Fact]
    public async Task Case13_ARemovedMember_StaysInThePublishedTeams()
    {
        using var client = api.CreateClient();
        var (world, round, members) = await G1Async(client);
        using var published = await PutAsync(world, round, G1Body(members));
        var removed = members[^1];

        using var removal = await world.SendAsync(A.Admin, HttpMethod.Delete, $"{world.GroupPath}/members/{removed}");
        var read = await RoundCalls.GetAsync(world, round, A.Player);

        Assert.True(removal.IsSuccessStatusCode);
        Assert.Contains(removed, read["teams"]!["reserves"]!.AsArray().Select(id => id!.GetValue<Guid>()));
        Assert.DoesNotContain(removed, read["going"]!.AsArray().Select(entry => entry!["memberId"]!.GetValue<Guid>()));
    }

    /// <summary>Case 7 on the wire: a cancelled round refuses the teams and hides the ones it had.</summary>
    [Fact]
    public async Task CancelledRound_RefusesAndHidesTheTeams()
    {
        using var client = api.CreateClient();
        var (world, round, members) = await G1Async(client);
        using var published = await PutAsync(world, round, G1Body(members));
        using var canceled = await world.SendAsync(A.Admin, HttpMethod.Post, RoundCalls.RoundPath(world, round) + "/cancel");

        using var refused = await PutAsync(world, round, G1Body(members));
        var read = await RoundCalls.GetAsync(world, round, A.Player);

        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        Assert.Equal(DrawCalls.RoundClosed, await RoundCalls.CodeAsync(refused));
        Assert.Null(read["teams"]);
    }
}
