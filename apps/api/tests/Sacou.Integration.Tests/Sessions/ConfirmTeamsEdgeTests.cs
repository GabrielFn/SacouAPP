using System.Net;
using System.Text.Json.Nodes;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Matches;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Sessions;

/// <summary>R100 part 1, extra cases: the account export carries the team slot, and an ended round refuses the teams on the wire.</summary>
public sealed class ConfirmTeamsEdgeTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int TeamOfSix = 6;
    private const int ScreenSevenExtras = 10;
    private const int FirstExtra = 4;
    private const int SecondTeamStart = 7;
    private const int LastExtra = 13;
    private const int PlayerReservePosition = 2;
    private const string ExportPath = "/v1/me/export";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    private static string TeamsPath(GroupWorld world, string roundId) => RoundCalls.RoundPath(world, roundId) + "/teams";

    private static string Body(IEnumerable<IEnumerable<Guid>> teams, IEnumerable<Guid> reserves) =>
        new JsonObject
        {
            ["teams"] = new JsonArray([.. teams.Select(team => (JsonNode)new JsonArray([.. team.Select(id => (JsonNode)JsonValue.Create(id))]))]),
            ["reserves"] = new JsonArray([.. reserves.Select(id => (JsonNode)JsonValue.Create(id))]),
        }.ToJsonString();

    private static async Task<JsonObject> AttendanceInExportAsync(GroupWorld world, A actor, string round)
    {
        using var response = await world.SendAsync(actor, HttpMethod.Get, ExportPath);
        var document = JsonNode.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!.AsObject();
        return document["attendances"]!.AsArray().Select(item => item!.AsObject())
            .Single(item => item["roundId"]!.GetValue<string>() == round);
    }

    /// <summary>The export (screen 30a) says the team of who plays and the reserve position of who waits, and nothing for the other.</summary>
    [Fact]
    public async Task Export_CarriesTeamNumberForPlayers_AndReservePositionForReserves()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await DrawCalls.RoundAsync(world);
        var members = await DrawCalls.ConfirmPlayersAsync(world, round, ScreenSevenExtras);
        IReadOnlyList<Guid> first = [members[0], members[1], members[2], .. members.Take(FirstExtra..(FirstExtra + TeamOfSix - 3))];
        var second = members.Take(SecondTeamStart..(SecondTeamStart + TeamOfSix));
        IReadOnlyList<Guid> reserves = [members[LastExtra], members[3]];

        using var put = await world.SendAsync(A.Admin, HttpMethod.Put, TeamsPath(world, round), Body([first, second], reserves));
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);

        var player = await AttendanceInExportAsync(world, A.Player, round);
        var admin = await AttendanceInExportAsync(world, A.Admin, round);
        var scorekeeper = await AttendanceInExportAsync(world, A.Scorekeeper, round);

        Assert.Null(player["teamNumber"]);
        Assert.Equal(PlayerReservePosition, player["reservePosition"]!.GetValue<int>());
        Assert.Equal(1, admin["teamNumber"]!.GetValue<int>());
        Assert.Null(admin["reservePosition"]);
        Assert.Equal(1, scorekeeper["teamNumber"]!.GetValue<int>());
    }

    /// <summary>Who is in no published team has both fields empty, and a second confirmation moves the number.</summary>
    [Fact]
    public async Task Export_FollowsTheLatestConfirmation_AndIsEmptyWithoutTeams()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await DrawCalls.RoundAsync(world);
        var members = await DrawCalls.ConfirmPlayersAsync(world, round, ScreenSevenExtras);
        var before = await AttendanceInExportAsync(world, A.Player, round);
        IReadOnlyList<Guid> others = [.. members.Where(id => id != members[3]).Take(TeamOfSix)];
        IReadOnlyList<Guid> withPlayer = [members[3], .. members.Take(SecondTeamStart..(SecondTeamStart + TeamOfSix - 1))];

        using var first = await world.SendAsync(A.Admin, HttpMethod.Put, TeamsPath(world, round), Body([others, withPlayer], []));
        using var second = await world.SendAsync(A.Admin, HttpMethod.Put, TeamsPath(world, round), Body([withPlayer, others], []));
        var after = await AttendanceInExportAsync(world, A.Player, round);

        Assert.Null(before["teamNumber"]);
        Assert.Null(before["reservePosition"]);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.Equal(1, after["teamNumber"]!.GetValue<int>());
        Assert.Null(after["reservePosition"]);
    }

    /// <summary>Acceptance G on the wire: "Encerrar rodada" and then the write is a 409, the teams already published stay readable.</summary>
    [Fact]
    public async Task AnEndedRound_RefusesTheTeams_ButStillShowsTheOnesItHad()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await DrawCalls.RoundAsync(world);
        var members = await DrawCalls.ConfirmPlayersAsync(world, round, ScreenSevenExtras);
        var body = Body([members.Take(TeamOfSix), members.Take(TeamOfSix..(TeamOfSix * 2))], members.Take((TeamOfSix * 2)..));
        using var published = await world.SendAsync(A.Admin, HttpMethod.Put, TeamsPath(world, round), body);
        var created = await RoundCalls.GetAsync(world, round);
        api.Clock.SetNow(created["startsAt"]!.GetValue<DateTimeOffset>().AddHours(-1));
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone,
            [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]), phone.Point("a"), phone.ManualEnd("a")]);
        using var closed = await world.SendAsync(A.Admin, HttpMethod.Post, RoundCalls.RoundPath(world, round) + "/close");
        Assert.Equal(HttpStatusCode.OK, closed.StatusCode);

        using var refused = await world.SendAsync(A.Admin, HttpMethod.Put, TeamsPath(world, round), body);
        var read = await RoundCalls.GetAsync(world, round, A.Player);

        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        Assert.Equal(DrawCalls.RoundClosed, await RoundCalls.CodeAsync(refused));
        Assert.Equal(DrawCalls.NoStore, refused.Headers.CacheControl?.ToString());
        Assert.NotNull(read["teams"]);
    }
}
