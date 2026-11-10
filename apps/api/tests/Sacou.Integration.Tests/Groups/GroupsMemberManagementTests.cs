using System.Net;
using System.Text.Json.Nodes;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Groups;

/// <summary>M6, M7 and M9 of E3.2 part 2, the last admin and the role checked under the lock, on the real API and a real Postgres.</summary>
public sealed class GroupsMemberManagementTests(IntegrationDatabase database) : IAsyncLifetime
{
    /// <summary>
    /// M7, written by hand from docs/dominio/grupos.md: actor × stored role of the target × new role, then the
    /// role the row holds afterwards. The target is a new member; for the admin rows the co-admin is made a
    /// second admin first, so the last admin rule never decides a row.
    /// </summary>
    public static readonly TheoryData<A, string, string, int, string> RoleRows = new()
    {
        { A.Admin, "admin", "admin", 200, "admin" },
        { A.Admin, "admin", "coAdmin", 200, "co_admin" },
        { A.Admin, "admin", "scorekeeper", 200, "scorekeeper" },
        { A.Admin, "admin", "player", 200, "player" },
        { A.Admin, "co_admin", "admin", 200, "admin" },
        { A.Admin, "co_admin", "coAdmin", 200, "co_admin" },
        { A.Admin, "co_admin", "scorekeeper", 200, "scorekeeper" },
        { A.Admin, "co_admin", "player", 200, "player" },
        { A.Admin, "scorekeeper", "admin", 200, "admin" },
        { A.Admin, "scorekeeper", "coAdmin", 200, "co_admin" },
        { A.Admin, "scorekeeper", "scorekeeper", 200, "scorekeeper" },
        { A.Admin, "scorekeeper", "player", 200, "player" },
        { A.Admin, "player", "admin", 200, "admin" },
        { A.Admin, "player", "coAdmin", 200, "co_admin" },
        { A.Admin, "player", "scorekeeper", 200, "scorekeeper" },
        { A.Admin, "player", "player", 200, "player" },

        { A.CoAdmin, "admin", "admin", 403, "admin" },
        { A.CoAdmin, "admin", "coAdmin", 403, "admin" },
        { A.CoAdmin, "admin", "scorekeeper", 403, "admin" },
        { A.CoAdmin, "admin", "player", 403, "admin" },
        { A.CoAdmin, "co_admin", "admin", 403, "co_admin" },
        { A.CoAdmin, "co_admin", "coAdmin", 403, "co_admin" },
        { A.CoAdmin, "co_admin", "scorekeeper", 403, "co_admin" },
        { A.CoAdmin, "co_admin", "player", 403, "co_admin" },
        { A.CoAdmin, "scorekeeper", "admin", 403, "scorekeeper" },
        { A.CoAdmin, "scorekeeper", "coAdmin", 403, "scorekeeper" },
        { A.CoAdmin, "scorekeeper", "scorekeeper", 200, "scorekeeper" },
        { A.CoAdmin, "scorekeeper", "player", 200, "player" },
        { A.CoAdmin, "player", "admin", 403, "player" },
        { A.CoAdmin, "player", "coAdmin", 403, "player" },
        { A.CoAdmin, "player", "scorekeeper", 200, "scorekeeper" },
        { A.CoAdmin, "player", "player", 200, "player" },

        { A.Scorekeeper, "player", "scorekeeper", 403, "player" },
        { A.Player, "player", "scorekeeper", 403, "player" },
    };

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Theory]
    [MemberData(nameof(RoleRows))]
    public async Task ChangeRole_FollowsTheTable(A actor, string targetRole, string newRole, int status, string storedAfter)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        if (actor == A.Admin)
        {
            await MemberRows.SetRoleAsync(api.ConnectionString, world.MemberIds[A.CoAdmin], "admin");
        }

        var target = await world.AddMemberAsync(targetRole);

        using var response = await world.SendAsync(actor, HttpMethod.Put, world.MemberPath(target) + "/role", $$"""{"role":"{{newRole}}"}""");

        Assert.Equal((HttpStatusCode)status, response.StatusCode);
        Assert.Equal(storedAfter, (await MemberRows.ReadAsync(api.ConnectionString, target)).Role);
        var body = await JsonAsync(response);
        if (response.IsSuccessStatusCode)
        {
            Assert.Equal(target, body["memberId"]!.GetValue<Guid>());
            Assert.Equal(newRole, body["role"]!.GetValue<string>());
            Assert.Equal(["memberId", "role"], Keys(body));
        }
        else
        {
            Assert.Equal("groups.forbidden", body["code"]!.GetValue<string>());
        }
    }

    /// <summary>M6: a member id of another group, on this group's route, is a member not found, and that member does not change.</summary>
    [Theory]
    [InlineData("PUT", "/role", """{"role":"player"}""")]
    [InlineData("PUT", "/type", """{"memberType":"regular"}""")]
    [InlineData("DELETE", "", null)]
    public async Task MemberOfAnotherGroup_IsNotFoundAndUntouched(string method, string suffix, string? json)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var stranger = world.MemberIds[A.OutsiderMember];
        var before = await MemberRows.ReadAsync(api.ConnectionString, stranger);

        using var refused = await world.SendAsync(A.Admin, new HttpMethod(method), world.MemberPath(stranger) + suffix, json);
        using var control = await world.SendAsync(A.Admin, new HttpMethod(method), world.MemberPath(world.MemberIds[A.Player]) + suffix, json);

        Assert.Equal(HttpStatusCode.NotFound, refused.StatusCode);
        Assert.Equal("groups.member-not-found", (await JsonAsync(refused))["code"]!.GetValue<string>());
        Assert.Equal(before, await MemberRows.ReadAsync(api.ConnectionString, stranger));
        Assert.True(control.IsSuccessStatusCode);
    }

    /// <summary>Someone who left or was removed, and an id nobody has, all look the same.</summary>
    [Theory]
    [InlineData(A.LeftMember)]
    [InlineData(A.RemovedMember)]
    [InlineData(null)]
    public async Task InactiveOrUnknownTarget_IsNotFound(A? target)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var id = target is { } actor ? world.MemberIds[actor] : Guid.NewGuid();

        using var response = await world.SendAsync(A.Admin, HttpMethod.Delete, world.MemberPath(id));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("groups.member-not-found", (await JsonAsync(response))["code"]!.GetValue<string>());
    }

    /// <summary>M9: removed, the same token gets the not-found of a non-member on the very next request.</summary>
    [Fact]
    public async Task RemovedMember_LosesAccessOnTheNextRequest()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        using var before = await world.SendAsync(A.Player, HttpMethod.Get, world.GroupPath);

        using var removed = await world.SendAsync(A.CoAdmin, HttpMethod.Delete, world.MemberPath(world.MemberIds[A.Player]));
        using var after = await world.SendAsync(A.Player, HttpMethod.Get, world.GroupPath);
        using var members = await world.SendAsync(A.Admin, HttpMethod.Get, world.GroupPath + "/members");

        Assert.Equal(HttpStatusCode.OK, before.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, removed.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, after.StatusCode);
        Assert.Equal("groups.group-not-found", (await JsonAsync(after))["code"]!.GetValue<string>());
        Assert.Equal(new MemberState("player", "drop_in", "removed", HasLeftAt: true), await MemberRows.ReadAsync(api.ConnectionString, world.MemberIds[A.Player]));
        Assert.DoesNotContain(world.MemberIds[A.Player].ToString(), await members.Content.ReadAsStringAsync(TestContext.Current.CancellationToken), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Leave_MarksTheMemberAsLeftAndEndsTheAccess()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var left = await world.SendAsync(A.Scorekeeper, HttpMethod.Post, world.GroupPath + "/leave");
        using var after = await world.SendAsync(A.Scorekeeper, HttpMethod.Get, world.GroupPath);
        using var again = await world.SendAsync(A.Scorekeeper, HttpMethod.Post, world.GroupPath + "/leave");

        Assert.Equal(HttpStatusCode.NoContent, left.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, after.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, again.StatusCode);
        Assert.Equal(new MemberState("scorekeeper", "drop_in", "left", HasLeftAt: true), await MemberRows.ReadAsync(api.ConnectionString, world.MemberIds[A.Scorekeeper]));
    }

    /// <summary>The only admin neither demotes themselves nor leaves; nobody removes themselves. Promoting someone first opens the door.</summary>
    [Fact]
    public async Task LastAdmin_PromotesSomeoneBeforeLeaving()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var admin = world.MemberIds[A.Admin];

        using var demoted = await world.SendAsync(A.Admin, HttpMethod.Put, world.MemberPath(admin) + "/role", """{"role":"coAdmin"}""");
        using var leftAlone = await world.SendAsync(A.Admin, HttpMethod.Post, world.GroupPath + "/leave");
        using var selfRemoved = await world.SendAsync(A.Admin, HttpMethod.Delete, world.MemberPath(admin));
        using var promoted = await world.SendAsync(A.Admin, HttpMethod.Put, world.MemberPath(world.MemberIds[A.CoAdmin]) + "/role", """{"role":"admin"}""");
        using var left = await world.SendAsync(A.Admin, HttpMethod.Post, world.GroupPath + "/leave");

        Assert.Equal(HttpStatusCode.Conflict, demoted.StatusCode);
        Assert.Equal("groups.last-admin", (await JsonAsync(demoted))["code"]!.GetValue<string>());
        Assert.Equal(HttpStatusCode.Conflict, leftAlone.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, selfRemoved.StatusCode);
        Assert.Equal("groups.use-leave", (await JsonAsync(selfRemoved))["code"]!.GetValue<string>());
        Assert.Equal(HttpStatusCode.OK, promoted.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, left.StatusCode);
        Assert.Equal(1, await MemberRows.CountActiveAdminsAsync(api.ConnectionString, world.GroupId));
    }

    [Fact]
    public async Task ChangeType_MakesARegularAndBack()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var path = world.MemberPath(world.MemberIds[A.Player]) + "/type";

        using var regular = await world.SendAsync(A.CoAdmin, HttpMethod.Put, path, """{"memberType":"regular"}""");
        var stored = await MemberRows.ReadAsync(api.ConnectionString, world.MemberIds[A.Player]);
        using var dropIn = await world.SendAsync(A.Admin, HttpMethod.Put, path, """{"memberType":"dropIn"}""");
        var body = await JsonAsync(regular);

        Assert.Equal(HttpStatusCode.OK, regular.StatusCode);
        Assert.Equal(["memberId", "memberType"], Keys(body));
        Assert.Equal("regular", body["memberType"]!.GetValue<string>());
        Assert.Equal("regular", stored.MemberType);
        Assert.Equal(HttpStatusCode.OK, dropIn.StatusCode);
        Assert.Equal("drop_in", (await MemberRows.ReadAsync(api.ConnectionString, world.MemberIds[A.Player])).MemberType);
    }

    /// <summary>
    /// The write judges the caller's role inside its own transaction: the test holds the group row, the
    /// co-admin's removal waits on it, the test demotes the co-admin and lets go. The removal is a 403 and
    /// the player stays. Without the FOR UPDATE the removal never waits, and the test fails.
    /// </summary>
    [Fact]
    public async Task DemotionThatLandsBeforeTheLock_StopsTheWrite()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await using var holder = await MemberRows.OpenAsync(api.ConnectionString);
        await using var transaction = await holder.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await GroupLock.HoldAsync(holder, world.GroupId);

        var removal = world.SendAsync(A.CoAdmin, HttpMethod.Delete, world.MemberPath(world.MemberIds[A.Player]));
        await GroupLock.WaitUntilBlockedAsync(api.ConnectionString, holder.ProcessID);
        await MemberRows.SetRoleAsync(api.ConnectionString, world.MemberIds[A.CoAdmin], "player");
        await transaction.CommitAsync(TestContext.Current.CancellationToken);
        using var response = await removal;

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("active", (await MemberRows.ReadAsync(api.ConnectionString, world.MemberIds[A.Player])).Status);
    }

    private static List<string> Keys(JsonObject json) => [.. json.Select(field => field.Key).Order(StringComparer.Ordinal)];

    private static async Task<JsonObject> JsonAsync(HttpResponseMessage response) =>
        JsonNode.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!.AsObject();
}
