using System.Net;
using System.Text.Json.Nodes;
using Npgsql;
using Xunit;

namespace Sacou.Integration.Tests.Groups;

/// <summary>M4, M5, the request rules and L1 of E3.2 part 1, end to end on a real Postgres.</summary>
public sealed class GroupsBehaviourTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int MembershipCeiling = 100;

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task Create_MakesTheCallerTheAdminAndShowsTheGroup()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var created = await world.SendAsync(GroupActor.NonMember, HttpMethod.Post, GroupWorld.GroupsPath, """{"name":"  Racha de sexta  "}""");
        var body = await JsonAsync(created);
        using var detail = await world.SendAsync(GroupActor.NonMember, HttpMethod.Get, $"{GroupWorld.GroupsPath}/{body["groupId"]}");
        var group = await JsonAsync(detail);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal($"{GroupWorld.GroupsPath}/{body["groupId"]}", created.Headers.Location?.OriginalString);
        Assert.Equal(["groupId", "memberId"], Keys(body));
        Assert.Equal("Racha de sexta", group["name"]!.GetValue<string>());
        Assert.Equal(body["memberId"]!.GetValue<Guid>(), group["memberId"]!.GetValue<Guid>());
        Assert.Equal("admin", group["role"]!.GetValue<string>());
        Assert.Equal("dropIn", group["memberType"]!.GetValue<string>());
        Assert.Equal(1, group["activeMembers"]!.GetValue<int>());
    }

    /// <summary>M4: only active groups, in the order the person joined.</summary>
    [Fact]
    public async Task ListMyGroups_ShowsOnlyTheActiveOnes()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var second = await world.CreateGroupAsync(GroupActor.Player, "Segundo racha");
        var third = await world.CreateGroupAsync(GroupActor.Player, "Terceiro racha");
        await LeaveAsync(world.Users[GroupActor.Player], third);

        using var response = await world.SendAsync(GroupActor.Player, HttpMethod.Get, GroupWorld.GroupsPath);
        var groups = (await JsonArrayAsync(response)).Select(group => group!.AsObject()).ToList();

        Assert.Equal([world.GroupId, second], groups.Select(group => group["groupId"]!.GetValue<Guid>()));
        Assert.Equal(["player", "admin"], groups.Select(group => group["role"]!.GetValue<string>()));
        Assert.All(groups, group => Assert.Equal(["groupId", "memberType", "name", "role"], Keys(group)));
    }

    /// <summary>M5: active members only, the caller marked, and nothing that points to a person outside the group.</summary>
    [Fact]
    public async Task ListMembers_ShowsActiveMembersWithoutPersonalData()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await world.SendAsync(GroupActor.Player, HttpMethod.Get, world.GroupPath + "/members");
        var members = (await JsonArrayAsync(response)).Select(member => member!.AsObject()).ToList();
        var text = members.Select(member => member.ToJsonString()).Aggregate(string.Concat);

        Assert.Equal(["admin", "coAdmin", "scorekeeper", "player"], members.Select(member => member["role"]!.GetValue<string>()));
        Assert.Single(members, member => member["isMe"]!.GetValue<bool>());
        Assert.Equal("player", members.Single(member => member["isMe"]!.GetValue<bool>())["role"]!.GetValue<string>());
        Assert.All(members, member => Assert.Equal(["hasAccount", "isMe", "joinedAt", "memberId", "memberType", "nickname", "otherPositions", "primaryPosition", "role"], Keys(member)));
        Assert.All(world.Users.Values, user => Assert.DoesNotContain(user.ToString(), text, StringComparison.OrdinalIgnoreCase));
        Assert.All(world.Subjects.Values, subject => Assert.DoesNotContain(subject, text, StringComparison.Ordinal));
    }

    /// <summary>H3 end to end: the refused value never comes back, and the code says why.</summary>
    [Theory]
    [InlineData("""{"name":"canario-123\u0000"}""", "groups.name-invalid")]
    [InlineData("""{"name":"   "}""", "groups.name-invalid")]
    [InlineData("""{}""", "groups.name-invalid")]
    public async Task InvalidName_IsRefusedWithoutEcho(string json, string code)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var create = await world.SendAsync(GroupActor.Admin, HttpMethod.Post, GroupWorld.GroupsPath, json);
        using var rename = await world.SendAsync(GroupActor.Admin, HttpMethod.Patch, world.GroupPath, json);

        foreach (var response in new[] { create, rename })
        {
            var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal(code, JsonNode.Parse(text)!["code"]!.GetValue<string>());
            Assert.DoesNotContain("canario", text, StringComparison.Ordinal);
        }
    }

    /// <summary>Mass assignment and malformed bodies: a 400 with no echo of the JSON, before any change.</summary>
    [Theory]
    [InlineData("""{"name":"Racha","groupId":"00000000-0000-0000-0000-000000000000"}""")]
    [InlineData("""{"name":"Racha","role":"admin"}""")]
    [InlineData("""{"name":"Racha","userId":"canario-123"}""")]
    [InlineData("""{"name":"canario-123""")]
    [InlineData("""[]""")]
    public async Task UnknownFieldOrMalformedBody_IsABareBadRequest(string json)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client, "Intocado");

        using var create = await world.SendAsync(GroupActor.Admin, HttpMethod.Post, GroupWorld.GroupsPath, json);
        using var rename = await world.SendAsync(GroupActor.Admin, HttpMethod.Patch, world.GroupPath, json);

        foreach (var response in new[] { create, rename })
        {
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.DoesNotContain("canario", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken), StringComparison.Ordinal);
        }

        Assert.Equal(1, await CountActiveGroupsAsync(world.Users[GroupActor.Admin]));
    }

    /// <summary>D8 end to end: the hundredth group is created, the next one is a 409, and nothing is written.</summary>
    [Fact]
    public async Task HundredActiveGroups_IsTheCeiling()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var user = world.Users[GroupActor.NonMember];
        for (var index = 0; index < MembershipCeiling - 1; index++)
        {
            await InsertGroupWithMemberAsync(user);
        }

        using var hundredth = await world.SendAsync(GroupActor.NonMember, HttpMethod.Post, GroupWorld.GroupsPath, """{"name":"Centésimo"}""");
        using var refused = await world.SendAsync(GroupActor.NonMember, HttpMethod.Post, GroupWorld.GroupsPath, """{"name":"Demais"}""");

        Assert.Equal(HttpStatusCode.Created, hundredth.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        Assert.Equal("groups.membership-limit", (await JsonAsync(refused))["code"]!.GetValue<string>());
        Assert.Equal(MembershipCeiling, await CountActiveGroupsAsync(user));
    }

    /// <summary>L1: no log entry carries a group name, a subject or a user id, though the provider does collect the API logs.</summary>
    [Fact]
    public async Task Logs_NeverCarryNamesSubjectsOrUserIds()
    {
        const string SecretName = "Racha secreto do Fulano";
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client, SecretName);
        using var renamed = await world.SendAsync(GroupActor.Admin, HttpMethod.Patch, world.GroupPath, """{"name":"Outro nome do Fulano"}""");
        using var listed = await world.SendAsync(GroupActor.Player, HttpMethod.Get, world.GroupPath + "/members");
        using var refused = await world.SendAsync(GroupActor.NonMember, HttpMethod.Get, world.GroupPath);

        var forbidden = world.Subjects.Values.Append("Fulano").Concat(world.Users.Values.Select(user => user.ToString()));

        Assert.NotEmpty(api.Logs.Entries);
        Assert.DoesNotContain(api.Logs.Entries, entry => forbidden.Any(value => entry.Contains(value, StringComparison.OrdinalIgnoreCase)));
    }

    private static List<string> Keys(JsonObject json) => [.. json.Select(field => field.Key).Order(StringComparer.Ordinal)];

    private static async Task<JsonObject> JsonAsync(HttpResponseMessage response) =>
        JsonNode.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!.AsObject();

    private static async Task<JsonArray> JsonArrayAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonNode.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!.AsArray();
    }

    private async Task LeaveAsync(Guid user, Guid group) => await ExecuteAsync(
        "UPDATE groups.members SET status = 'left', left_at = now() WHERE group_id = @group AND user_id = @user",
        ("group", group), ("user", user));

    private async Task InsertGroupWithMemberAsync(Guid user)
    {
        var group = Guid.CreateVersion7();
        await ExecuteAsync("INSERT INTO groups.groups (id, name, created_at) VALUES (@group, 'Racha', now())", ("group", group));
        await ExecuteAsync(
            "INSERT INTO groups.members (id, group_id, user_id, role, member_type, status, joined_at) VALUES (@id, @group, @user, 'player', 'drop_in', 'active', now())",
            ("id", Guid.CreateVersion7()), ("group", group), ("user", user));
    }

    private async Task<long> CountActiveGroupsAsync(Guid user)
    {
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var count = new NpgsqlCommand("SELECT count(*) FROM groups.members WHERE user_id = @user AND status = 'active'", connection);
        count.Parameters.AddWithValue("user", user);
        return (long)(await count.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
    }

    private async Task ExecuteAsync(string sql, params (string Name, Guid Value)[] parameters)
    {
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        foreach (var (name, value) in parameters)
        {
            command.Parameters.AddWithValue(name, value);
        }

        await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }
}
