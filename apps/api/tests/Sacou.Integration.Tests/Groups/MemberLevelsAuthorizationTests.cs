using System.Net;
using System.Text.Json.Nodes;
using Sacou.Integration.Tests.Identity;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;
using R = Sacou.Integration.Tests.Groups.LevelRoute;

namespace Sacou.Integration.Tests.Groups;

/// <summary>The three level routes of E3.17, part 2.</summary>
public enum LevelRoute
{
    ListLevels,
    SetLevel,
    SetLevels,
}

/// <summary>
/// P2 of E3.17 on the real API and a real Postgres: who may read or write the admin's level (ADR 0051, D7 and D8).
/// The matrix is written by hand from docs/dominio/perfil-e-nota.md, never derived from the production table.
/// </summary>
public sealed class MemberLevelsAuthorizationTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string NotRegistered = "identity.user-not-registered";
    private const string NotFound = "groups.group-not-found";
    private const string Forbidden = "groups.forbidden";
    private const string MarkerLevel = "1.5";
    private const short MarkerTenths = 15;
    private const decimal Marker = 1.5m;
    private const int Ok = 200;

    private readonly ApiWithDatabase api = new(database);

    public static TheoryData<A, R, int, string?> Matrix { get; } = new()
    {
        { A.Admin, R.ListLevels, 200, null },
        { A.Admin, R.SetLevel, 200, null },
        { A.Admin, R.SetLevels, 200, null },
        { A.CoAdmin, R.ListLevels, 200, null },
        { A.CoAdmin, R.SetLevel, 200, null },
        { A.CoAdmin, R.SetLevels, 200, null },
        { A.Scorekeeper, R.ListLevels, 403, Forbidden },
        { A.Scorekeeper, R.SetLevel, 403, Forbidden },
        { A.Scorekeeper, R.SetLevels, 403, Forbidden },
        { A.Player, R.ListLevels, 403, Forbidden },
        { A.Player, R.SetLevel, 403, Forbidden },
        { A.Player, R.SetLevels, 403, Forbidden },
        { A.LeftMember, R.ListLevels, 404, NotFound },
        { A.LeftMember, R.SetLevel, 404, NotFound },
        { A.LeftMember, R.SetLevels, 404, NotFound },
        { A.RemovedMember, R.ListLevels, 404, NotFound },
        { A.RemovedMember, R.SetLevel, 404, NotFound },
        { A.RemovedMember, R.SetLevels, 404, NotFound },
        { A.OutsiderMember, R.ListLevels, 404, NotFound },
        { A.OutsiderMember, R.SetLevel, 404, NotFound },
        { A.OutsiderMember, R.SetLevels, 404, NotFound },
        { A.NonMember, R.ListLevels, 404, NotFound },
        { A.NonMember, R.SetLevel, 404, NotFound },
        { A.NonMember, R.SetLevels, 404, NotFound },
        { A.Unregistered, R.ListLevels, 403, NotRegistered },
        { A.Unregistered, R.SetLevel, 403, NotRegistered },
        { A.Unregistered, R.SetLevels, 403, NotRegistered },
        { A.Anonymous, R.ListLevels, 401, null },
        { A.Anonymous, R.SetLevel, 401, null },
        { A.Anonymous, R.SetLevels, 401, null },
    };

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>Every refused call leaves the player's level as it was: no row at all.</summary>
    [Theory]
    [MemberData(nameof(Matrix))]
    public async Task Matrix_EveryActorOnEveryLevelRoute(A actor, LevelRoute route, int status, string? code)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var target = world.MemberIds[A.Player];
        var (method, path, json) = route switch
        {
            R.ListLevels => (HttpMethod.Get, LevelCalls.ListPath(world), null),
            R.SetLevel => (HttpMethod.Put, LevelCalls.MemberPath(world, target), LevelCalls.One("4.5")),
            R.SetLevels => (HttpMethod.Put, LevelCalls.ListPath(world), LevelCalls.Batch((target, "4.5"))),
            _ => throw new ArgumentOutOfRangeException(nameof(route), route, "Every route needs a request."),
        };

        using var response = await world.SendAsync(actor, method, path, json);

        Assert.Equal((HttpStatusCode)status, response.StatusCode);
        Assert.Equal(code, await SettingsCalls.CodeAsync(response));
        if (status != Ok)
        {
            Assert.Null(await LevelCalls.ReadAsync(api.ConnectionString, target));
        }
    }

    [Fact]
    public void Matrix_HasOneRowPerActorAndRoute()
    {
        var pairs = Matrix.Select(row => (row.Data.Item1, row.Data.Item2)).ToHashSet();

        Assert.Equal(Enum.GetValues<A>().Length * Enum.GetValues<R>().Length, pairs.Count);
        Assert.Equal(Matrix.Count, pairs.Count);
    }

    /// <summary>
    /// "O jogador lê a própria nota: nunca vem." The admin gives the player 1,5 (a marker) and the player suggests 4,0.
    /// On every read the player and the scorekeeper have, no field names a level and the marker never shows.
    /// </summary>
    [Theory]
    [InlineData(A.Player)]
    [InlineData(A.Scorekeeper)]
    public async Task OwnLevel_NeverReachesThePlayerOrTheScorekeeper(A reader)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        using var suggested = await world.SendAsync(reader, HttpMethod.Put, ProfileRows.ProfilePath, ProfileRows.Body(level: "4.0"));
        using var set = await LevelCalls.SetAsync(world, A.Admin, world.MemberIds[reader], MarkerLevel);
        Assert.Equal(HttpStatusCode.OK, set.StatusCode);
        Assert.Equal(MarkerTenths, (await LevelCalls.ReadAsync(api.ConnectionString, world.MemberIds[reader]))!.Tenths);
        string[] reads =
        [
            ProfileRows.ProfilePath, GroupWorld.GroupsPath, world.GroupPath, world.GroupPath + "/members", world.GroupPath + "/settings",
            world.GroupPath + "/rounds", LevelCalls.ListPath(world),
        ];

        foreach (var path in reads)
        {
            using var response = await world.SendAsync(reader, HttpMethod.Get, path);
            var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

            Assert.True(response.StatusCode is HttpStatusCode.OK or HttpStatusCode.Forbidden, path);
            Assert.DoesNotContain(Marker, Numbers(text.Length == 0 ? null : JsonNode.Parse(text)));
            Assert.DoesNotContain("adminLevel", text, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("reviewed", text, StringComparison.OrdinalIgnoreCase);
        }
    }

    /// <summary>IDOR: the admin of A names a member of B, alone or between two of A's. 404, and B's level stays.</summary>
    [Fact]
    public async Task MemberOfAnotherGroup_IsNotFound_AndKeepsItsLevel()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var foreign = world.MemberIds[A.OutsiderMember];
        var otherPath = $"{GroupWorld.GroupsPath}/{world.OtherGroupId}/member-levels/{foreign}";
        using var own = await world.SendAsync(A.OutsiderMember, HttpMethod.Put, otherPath, LevelCalls.One("2.0"));
        Assert.Equal(HttpStatusCode.OK, own.StatusCode);

        using var single = await LevelCalls.SetAsync(world, A.Admin, foreign, "5.0");
        using var batch = await world.SendAsync(A.Admin, HttpMethod.Put, LevelCalls.ListPath(world), LevelCalls.Batch(
            (world.MemberIds[A.Player], "3.0"), (foreign, "5.0"), (world.MemberIds[A.Scorekeeper], "3.0")));

        Assert.Equal(HttpStatusCode.NotFound, single.StatusCode);
        Assert.Equal(LevelCalls.MemberNotFound, await SettingsCalls.CodeAsync(single));
        Assert.Equal(HttpStatusCode.NotFound, batch.StatusCode);
        Assert.Equal(LevelCalls.MemberNotFound, await SettingsCalls.CodeAsync(batch));
        Assert.Equal(new LevelState(20, foreign), await LevelCalls.ReadAsync(api.ConnectionString, foreign));
        Assert.Equal(0, await LevelCalls.CountAsync(api.ConnectionString, world.GroupId));
    }

    /// <summary>A missing group and someone else's group look the same, byte for byte, as on every group route.</summary>
    [Fact]
    public async Task MissingGroup_IsTheGroupNotFound()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await world.SendAsync(A.Admin, HttpMethod.Get, $"{GroupWorld.GroupsPath}/{Guid.NewGuid()}/member-levels");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(NotFound, await SettingsCalls.CodeAsync(response));
    }

    /// <summary>Every number in the document, at any depth: the marker is looked for as a number, never inside a timestamp.</summary>
    private static IEnumerable<decimal> Numbers(JsonNode? node) => node switch
    {
        JsonObject item => item.SelectMany(field => Numbers(field.Value)),
        JsonArray list => list.SelectMany(Numbers),
        JsonValue value when value.GetValueKind() == System.Text.Json.JsonValueKind.Number => [value.GetValue<decimal>()],
        _ => [],
    };
}
