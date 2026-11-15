using System.Net;
using System.Text.Json.Nodes;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Identity;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Sessions;

/// <summary>
/// S1 to S8 of E3.6 (part 2) on the real API and a real Postgres: who may draw, what the answer carries and never
/// carries, the refusals, and the levels of the database (admin, suggestion, guest) in the case of screen 07.
/// </summary>
public sealed class DrawTeamsTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int TeamOfSix = 6;
    private const int TeamOfTwo = 2;
    private const int ScreenSevenExtras = 4;

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>S1: the admin and the co-admin draw, with the levels, and nothing along the way keeps the answer.</summary>
    [Theory]
    [InlineData(A.Admin)]
    [InlineData(A.CoAdmin)]
    public async Task AdminAndCoAdmin_Draw_WithLevels_AndNoStore(A actor)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await DrawCalls.RoundAsync(world);
        var members = await DrawCalls.ConfirmPlayersAsync(world, round, extra: 0);

        using var response = await DrawCalls.DrawAsync(world, round, actor);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(DrawCalls.NoStore, response.Headers.CacheControl?.ToString());
        var body = await RoundCalls.JsonAsync(response);
        Assert.Equal(TeamOfTwo, body["playersPerTeam"]!.GetValue<int>());
        var drawn = body["teams"]!.AsArray().SelectMany(team => team!["members"]!.AsArray()).ToList();
        Assert.Equal(members.Order(), drawn.Select(player => player!["memberId"]!.GetValue<Guid>()).Order());
        Assert.All(drawn, player => Assert.Equal(30, player!["levelTenths"]!.GetValue<int>()));
    }

    /// <summary>S2: the scorekeeper and the player are forbidden; who is not a member gets the group's 404.</summary>
    [Theory]
    [InlineData(A.Scorekeeper, HttpStatusCode.Forbidden, RoundCalls.Forbidden)]
    [InlineData(A.Player, HttpStatusCode.Forbidden, RoundCalls.Forbidden)]
    [InlineData(A.LeftMember, HttpStatusCode.NotFound, RoundCalls.GroupNotFound)]
    [InlineData(A.RemovedMember, HttpStatusCode.NotFound, RoundCalls.GroupNotFound)]
    [InlineData(A.OutsiderMember, HttpStatusCode.NotFound, RoundCalls.GroupNotFound)]
    [InlineData(A.NonMember, HttpStatusCode.NotFound, RoundCalls.GroupNotFound)]
    [InlineData(A.Unregistered, HttpStatusCode.Forbidden, RoundCalls.NotRegistered)]
    [InlineData(A.Anonymous, HttpStatusCode.Unauthorized, null)]
    public async Task OtherActors_AreRefused_WithoutLevels(A actor, HttpStatusCode status, string? code)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await DrawCalls.RoundAsync(world);
        _ = await DrawCalls.ConfirmPlayersAsync(world, round, extra: 0);

        using var response = await DrawCalls.DrawAsync(world, round, actor);

        Assert.Equal(status, response.StatusCode);
        Assert.Equal(code, await RoundCalls.CodeAsync(response));
        Assert.DoesNotContain("levelTenths", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken), StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>S2: a round of group B through group A's route is not found.</summary>
    [Fact]
    public async Task RoundOfAnotherGroup_IsNotFound()
    {
        using var client = api.CreateClient();
        var a = await GroupWorld.CreateAsync(api, client, "Racha A");
        var b = await GroupWorld.CreateAsync(api, client, "Racha B");
        await DrawCalls.EnableAsync(a);
        var roundB = await DrawCalls.RoundAsync(b);
        _ = await DrawCalls.ConfirmPlayersAsync(b, roundB, extra: 0);

        using var response = await a.SendAsync(A.Admin, HttpMethod.Post, DrawCalls.DrawPath(a, roundB), DrawCalls.EmptyBody);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("sessions.round-not-found", await RoundCalls.CodeAsync(response));
    }

    /// <summary>S3: the answer is exactly the fields of the plan: no origin of a level, nickname or suggestion.</summary>
    [Fact]
    public async Task Answer_HasOnlyThePlannedFields()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await DrawCalls.RoundAsync(world);
        _ = await DrawCalls.ConfirmPlayersAsync(world, round, extra: 1);

        using var response = await DrawCalls.DrawAsync(world, round);
        var body = await RoundCalls.JsonAsync(response);

        Assert.Equal(["seed", "playersPerTeam", "teams", "reserves", "differenceTenths"], body.Select(field => field.Key));
        var team = body["teams"]![0]!.AsObject();
        Assert.Equal(["number", "members", "averageTenths"], team.Select(field => field.Key));
        Assert.Equal(["memberId", "levelTenths"], team["members"]![0]!.AsObject().Select(field => field.Key));
        Assert.Equal(["memberId", "levelTenths"], body["reserves"]![0]!.AsObject().Select(field => field.Key));
        Assert.True(ulong.TryParse(body["seed"]!.GetValue<string>(), System.Globalization.CultureInfo.InvariantCulture, out _));
    }

    /// <summary>S4: after a draw, the round and the member list still carry no level, for the admin and the player.</summary>
    [Theory]
    [InlineData(A.Admin)]
    [InlineData(A.Player)]
    public async Task RoundAndMembers_StillWithoutLevels_AfterADraw(A actor)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await DrawCalls.RoundAsync(world);
        var members = await DrawCalls.ConfirmPlayersAsync(world, round, extra: 0);
        using var level = await LevelCalls.SetAsync(world, A.Admin, members[0], "4.5");
        using var drawn = await DrawCalls.DrawAsync(world, round);
        Assert.Equal(HttpStatusCode.OK, drawn.StatusCode);

        using var roundRead = await world.SendAsync(actor, HttpMethod.Get, RoundCalls.RoundPath(world, round));
        using var memberList = await world.SendAsync(actor, HttpMethod.Get, world.GroupPath + "/members");

        foreach (var read in new[] { roundRead, memberList })
        {
            Assert.Equal(HttpStatusCode.OK, read.StatusCode);
            // A property named like a level ("level", "levelTenths"); the round's settings carry "balanceByLevel", which is no level.
            Assert.DoesNotContain("\"level", await read.Content.ReadAsStringAsync(TestContext.Current.CancellationToken), StringComparison.OrdinalIgnoreCase);
        }
    }

    /// <summary>S5: the log of a draw has the ids and the counts, never a level, the seed or the body.</summary>
    [Fact]
    public async Task Log_HasCounts_NeverLevelsSeedOrBody()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await DrawCalls.RoundAsync(world);
        var members = await DrawCalls.ConfirmPlayersAsync(world, round, extra: 0);
        var start = api.Logs.Count;

        using var response = await DrawCalls.DrawAsync(world, round, body: DrawCalls.Together(members[0], members[1]));
        var seed = (await RoundCalls.JsonAsync(response))["seed"]!.GetValue<string>();

        var entries = api.Logs.EntriesSince(start);
        Assert.Contains(entries, entry => entry.Contains($"draw of round {round}", StringComparison.Ordinal) && entry.Contains("4 players", StringComparison.Ordinal));
        string[] forbidden = ["levelTenths", "LevelTenths", "averageTenths", seed, "together", "DrawPlayer", members[1].ToString()];
        Assert.DoesNotContain(entries, entry => forbidden.Any(value => entry.Contains(value, StringComparison.OrdinalIgnoreCase)));
    }

    /// <summary>S6: the draw off, a cancelled round and too few players are conflicts.</summary>
    [Fact]
    public async Task DrawOff_CancelledRound_AndTooFewPlayers_AreConflicts()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await DrawCalls.RoundAsync(world);
        _ = await DrawCalls.ConfirmPlayersAsync(world, round, extra: 0);
        var few = (await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(RoundCalls.FutureDate(4))))["roundId"]!.GetValue<string>();
        await DrawCalls.ConfirmAsync(world, few, [world.MemberIds[A.Admin], world.MemberIds[A.CoAdmin], world.MemberIds[A.Player]]);

        using var tooFew = await DrawCalls.DrawAsync(world, few);
        await DrawCalls.EnableAsync(world, enabled: false);
        using var off = await DrawCalls.DrawAsync(world, round);
        await DrawCalls.EnableAsync(world);
        using var cancel = await world.SendAsync(A.Admin, HttpMethod.Post, RoundCalls.RoundPath(world, round) + "/cancel");
        using var cancelled = await DrawCalls.DrawAsync(world, round);

        Assert.Equal("sessions.draw-not-enough-players", await RoundCalls.CodeAsync(tooFew));
        Assert.Equal(DrawCalls.DrawDisabled, await RoundCalls.CodeAsync(off));
        Assert.Equal(DrawCalls.RoundClosed, await RoundCalls.CodeAsync(cancelled));
        Assert.All(new[] { tooFew, off, cancelled }, response => Assert.Equal(HttpStatusCode.Conflict, response.StatusCode));
    }

    /// <summary>S7: a body the strict reading refuses is a 400, never a 500 and never a default lock.</summary>
    [Theory]
    [InlineData("{")]
    [InlineData("")]
    [InlineData("""{"locks":[],"seed":"1"}""")]
    [InlineData("""{"locks":[{"first":"00000000-0000-0000-0000-000000000001","second":"00000000-0000-0000-0000-000000000002","kind":"maybe"}]}""")]
    [InlineData("""{"locks":[{"first":"00000000-0000-0000-0000-000000000001","second":"00000000-0000-0000-0000-000000000002","kind":0}]}""")]
    [InlineData("""{"locks":[{"first":"00000000-0000-0000-0000-000000000001","second":"00000000-0000-0000-0000-000000000002"}]}""")]
    [InlineData("""{"locks":[{"first":"ana","second":"00000000-0000-0000-0000-000000000002","kind":"together"}]}""")]
    [InlineData("""{"locks":[null]}""")]
    [InlineData("""{"reserves":["ana"]}""")]
    [InlineData("""{"reserves":[null]}""")]
    [InlineData("""{"locks":"together"}""")]
    public async Task MalformedBody_Is400(string body)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await DrawCalls.RoundAsync(world);
        _ = await DrawCalls.ConfirmPlayersAsync(world, round, extra: 0);

        using var response = await DrawCalls.DrawAsync(world, round, body: body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    /// <summary>S7: locks and reserves the domain refuses keep their codes, with no name or level in the answer.</summary>
    [Fact]
    public async Task LocksAndReservesTheDomainRefuses_AreTheirCodes()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await DrawCalls.RoundAsync(world);
        var members = await DrawCalls.ConfirmPlayersAsync(world, round, extra: 1);
        var outsider = world.MemberIds[A.OutsiderMember];

        using var withOutsider = await DrawCalls.DrawAsync(world, round, body: DrawCalls.Together(members[0], outsider));
        using var withSelf = await DrawCalls.DrawAsync(world, round, body: DrawCalls.Together(members[0], members[0]));
        using var badReserves = await DrawCalls.DrawAsync(world, round, body: $$"""{"reserves":["{{outsider}}"]}""");
        using var reserves = await DrawCalls.DrawAsync(world, round, body: $$"""{"reserves":["{{members[0]}}"]}""");

        Assert.Equal("sessions.draw-lock-invalid", await RoundCalls.CodeAsync(withOutsider));
        Assert.Equal("sessions.draw-lock-invalid", await RoundCalls.CodeAsync(withSelf));
        Assert.Equal("sessions.draw-reserves-invalid", await RoundCalls.CodeAsync(badReserves));
        Assert.Equal(HttpStatusCode.OK, reserves.StatusCode);
        Assert.Equal(members[0], (await RoundCalls.JsonAsync(reserves))["reserves"]![0]!["memberId"]!.GetValue<Guid>());
    }

    /// <summary>
    /// S8: screen 07 (G1) with the levels of the database: admin levels, a player's own suggestion, a guest without a
    /// level (3,0) and a person with nothing (3,0). Davi and Sofia, the last to arrive, are the reserves; Ana and João
    /// play together; the sums are 220 and 225, the averages 3,7 and 3,8, the difference 0,1.
    /// </summary>
    [Fact]
    public async Task ScreenSeven_WithTheLevelsOfTheDatabase()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await DrawCalls.RoundAsync(world);
        var ana = world.MemberIds[A.Admin];
        var joao = world.MemberIds[A.CoAdmin];
        var marcos = await GuestCalls.CreateAsync(world, "Marcos");
        var (biaSubject, bia) = await world.AddPersonAsync();
        using (var suggestion = await world.SendAsAsync(biaSubject, HttpMethod.Put, ProfileRows.ProfilePath, ProfileRows.Body("Bia", level: "3.5")))
        {
            Assert.Equal(HttpStatusCode.OK, suggestion.StatusCode);
        }

        var extras = new List<Guid>();
        for (var added = 0; added < ScreenSevenExtras; added++)
        {
            extras.Add((await world.AddPersonAsync()).MemberId);
        }

        var leo = await GuestCalls.CreateAsync(world, "Léo", level: "3");
        var (gabi, davi, sofia) = ((await world.AddPersonAsync()).MemberId, (await world.AddPersonAsync()).MemberId, (await world.AddPersonAsync()).MemberId);
        // The extras are Rafa, Duda, Caio and Nina, who arrive between Bia and Léo.
        Guid[] order = [ana, joao, world.MemberIds[A.Scorekeeper], world.MemberIds[A.Player], marcos, bia, extras[0], extras[1], extras[2], extras[3], leo, gabi, davi, sofia];
        (Guid Member, string Level)[] adminLevels =
        [
            (ana, "4"), (joao, "4"), (world.MemberIds[A.Scorekeeper], "4.5"), (world.MemberIds[A.Player], "3.5"),
            (extras[0], "4"), (extras[1], "3.5"), (extras[2], "4"), (extras[3], "3.5"), (gabi, "4"), (davi, "3.5"),
        ];
        foreach (var (member, level) in adminLevels)
        {
            using var set = await LevelCalls.SetAsync(world, A.Admin, member, level);
            Assert.Equal(HttpStatusCode.OK, set.StatusCode);
        }

        await DrawCalls.ConfirmAsync(world, round, order);

        using var response = await DrawCalls.DrawAsync(world, round, body: DrawCalls.Together(ana, joao));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await RoundCalls.JsonAsync(response);
        Assert.Equal(TeamOfSix, body["playersPerTeam"]!.GetValue<int>());
        Assert.Equal([davi, sofia], body["reserves"]!.AsArray().Select(player => player!["memberId"]!.GetValue<Guid>()));
        Assert.Equal([35, 30], body["reserves"]!.AsArray().Select(player => player!["levelTenths"]!.GetValue<int>()));
        var teams = body["teams"]!.AsArray().Select(team => team!.AsObject()).ToList();
        Assert.Equal(2, teams.Count);
        Assert.Equal([220, 225], teams.Select(team => team["members"]!.AsArray().Sum(player => player!["levelTenths"]!.GetValue<int>())).Order());
        Assert.Equal([37, 38], teams.Select(team => team["averageTenths"]!.GetValue<int>()).Order());
        Assert.Equal(1, body["differenceTenths"]!.GetValue<int>());
        Assert.Single(teams, team => MembersOf(team).Contains(ana) && MembersOf(team).Contains(joao));
        var levels = teams.SelectMany(team => team["members"]!.AsArray()).ToDictionary(player => player!["memberId"]!.GetValue<Guid>(), player => player!["levelTenths"]!.GetValue<int>());
        Assert.Equal((35, 30, 30), (levels[bia], levels[marcos], levels[leo]));
    }

    private static List<Guid> MembersOf(JsonObject team) =>
        [.. team["members"]!.AsArray().Select(player => player!["memberId"]!.GetValue<Guid>())];
}
