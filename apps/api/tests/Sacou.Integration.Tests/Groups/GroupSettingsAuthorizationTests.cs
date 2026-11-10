using System.Net;
using System.Text.Json.Nodes;
using Npgsql;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Groups;

/// <summary>M1 to M3 and M5 of E3.3 on the real API and a real Postgres: who may read or change the settings and the templates.</summary>
public sealed class GroupSettingsAuthorizationTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string TraceIdField = "traceId";
    private const string NotFoundCode = "groups.template-not-found";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Theory]
    [MemberData(nameof(SettingsAuthorizationMatrix.Rows), MemberType = typeof(SettingsAuthorizationMatrix))]
    public async Task Matrix_EveryActorOnEverySettingsRoute(A actor, SettingsRoute route, int status, string? code)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var templateId = await SettingsCalls.SaveAsync(world, world.GroupPath, "Para apagar");
        var (method, path, json) = SettingsAuthorizationMatrix.Request(world, route, templateId);

        using var response = await world.SendAsync(actor, method, path, json);

        Assert.Equal((HttpStatusCode)status, response.StatusCode);
        Assert.Equal(code, await SettingsCalls.CodeAsync(response));
    }

    [Fact]
    public void Matrix_HasOneRowPerActorAndRoute()
    {
        var pairs = SettingsAuthorizationMatrix.Rows.Select(row => (row.Data.Item1, row.Data.Item2)).ToHashSet();

        Assert.Equal(Enum.GetValues<A>().Length * Enum.GetValues<SettingsRoute>().Length, pairs.Count);
        Assert.Equal(SettingsAuthorizationMatrix.Rows.Count, pairs.Count);
    }

    /// <summary>A refused write changes nothing: the control is the admin's write in the same test.</summary>
    [Theory]
    [InlineData(A.Player)]
    [InlineData(A.Scorekeeper)]
    [InlineData(A.NonMember)]
    [InlineData(A.LeftMember)]
    public async Task RefusedPatch_KeepsTheSettings(A actor)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var before = await SettingsCalls.GetAsync(world, world.GroupPath);

        using var refused = await world.SendAsync(actor, HttpMethod.Patch, world.GroupPath + "/settings", SettingsCalls.PatchBestOf3);
        var unchanged = await SettingsCalls.GetAsync(world, world.GroupPath);
        var allowed = await SettingsCalls.PatchAsync(world, world.GroupPath, SettingsCalls.PatchBestOf3);

        Assert.NotEqual(HttpStatusCode.OK, refused.StatusCode);
        Assert.True(JsonNode.DeepEquals(before, unchanged));
        Assert.Equal(3, allowed["settings"]!["scoring"]!["bestOf"]!.GetValue<int>());
    }

    /// <summary>M2: a missing group, someone else's, one I left and one I was removed from look the same, byte for byte, on the new routes.</summary>
    [Theory]
    [InlineData("GET", "/settings")]
    [InlineData("PATCH", "/settings")]
    [InlineData("POST", "/settings/apply-template")]
    [InlineData("GET", "/templates")]
    [InlineData("POST", "/templates")]
    public async Task NotFound_IsIdenticalForEveryKindOfNonMember(string method, string suffix)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var json = suffix switch
        {
            "/settings" when method == "PATCH" => SettingsCalls.PatchBestOf3,
            "/settings/apply-template" => """{"templateKey":"treino"}""",
            "/templates" when method == "POST" => """{"name":"Qualquer"}""",
            _ => null,
        };
        var missing = $"{GroupWorld.GroupsPath}/{Guid.NewGuid()}{suffix}";

        var bodies = new[]
        {
            await BodyAsync(world, A.NonMember, method, missing, json),
            await BodyAsync(world, A.OutsiderMember, method, world.GroupPath + suffix, json),
            await BodyAsync(world, A.LeftMember, method, world.GroupPath + suffix, json),
            await BodyAsync(world, A.RemovedMember, method, world.GroupPath + suffix, json),
            await BodyAsync(world, A.Admin, method, missing, json),
        };

        Assert.Single(bodies.Distinct(StringComparer.Ordinal));
        Assert.Contains("groups.group-not-found", bodies[0], StringComparison.Ordinal);
    }

    /// <summary>M2, for the delete: the group is missing, so is the template, and the answer is the group's.</summary>
    [Fact]
    public async Task DeleteInAMissingGroup_IsTheGroupNotFound()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await world.SendAsync(
            A.Admin, HttpMethod.Delete, $"{GroupWorld.GroupsPath}/{Guid.NewGuid()}/templates/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("groups.group-not-found", await SettingsCalls.CodeAsync(response));
    }

    /// <summary>
    /// M3: the admin of group A names a template of group B on A's routes. Applying and deleting both answer
    /// "not found", the settings of A do not change and the template of B is still there.
    /// </summary>
    [Fact]
    public async Task TemplateOfAnotherGroup_IsNotFound_AndIntact()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var otherPath = $"{GroupWorld.GroupsPath}/{world.OtherGroupId}";
        var foreign = await SettingsCalls.SaveAsync(world, otherPath, "Do outro racha", A.OutsiderMember);
        var before = await SettingsCalls.GetAsync(world, world.GroupPath);

        using var apply = await world.SendAsync(A.Admin, HttpMethod.Post, world.GroupPath + "/settings/apply-template", $$"""{"savedTemplateId":"{{foreign}}"}""");
        using var delete = await world.SendAsync(A.Admin, HttpMethod.Delete, $"{world.GroupPath}/templates/{foreign}");
        var listed = await SettingsCalls.ListAsync(world, otherPath, A.OutsiderMember);
        var after = await SettingsCalls.GetAsync(world, world.GroupPath);

        Assert.Equal(HttpStatusCode.NotFound, apply.StatusCode);
        Assert.Equal(NotFoundCode, await SettingsCalls.CodeAsync(apply));
        Assert.Equal(HttpStatusCode.NotFound, delete.StatusCode);
        Assert.Equal(NotFoundCode, await SettingsCalls.CodeAsync(delete));
        Assert.Contains(listed, item => item!["templateId"]!.GetValue<Guid>() == foreign);
        Assert.True(JsonNode.DeepEquals(before, after));
        Assert.Empty(await SettingsCalls.ListAsync(world, world.GroupPath));
    }

    /// <summary>
    /// M5: the co-admin is demoted after the filter has read the role but before the write takes the lock. A
    /// session holds the lock on the settings row while the test demotes; the request then gets 403 and the
    /// settings stay as they were.
    /// </summary>
    [Fact]
    public async Task DemotionThatLandsAfterTheFilter_StopsThePatch()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var before = await SettingsCalls.GetAsync(world, world.GroupPath);
        await using var connection = await OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await ExecuteAsync(connection, "SELECT group_id FROM groups.group_settings WHERE group_id = @group FOR UPDATE", world);

        var patch = world.SendAsync(A.CoAdmin, HttpMethod.Patch, world.GroupPath + "/settings", SettingsCalls.PatchBestOf3);
        await GroupLock.WaitUntilBlockedAsync(api.ConnectionString, connection.ProcessID);
        await ExecuteAsync(connection, "UPDATE groups.members SET role = 'player' WHERE group_id = @group AND user_id = @user", world);
        await transaction.CommitAsync(TestContext.Current.CancellationToken);
        using var response = await patch;

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("groups.forbidden", await SettingsCalls.CodeAsync(response));
        Assert.True(JsonNode.DeepEquals(before, await SettingsCalls.GetAsync(world, world.GroupPath)));
    }

    private static async Task<string> BodyAsync(GroupWorld world, A actor, string method, string path, string? json)
    {
        using var response = await world.SendAsync(actor, new HttpMethod(method), path, json);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var body = await SettingsCalls.JsonAsync(response);
        Assert.True(body.Remove(TraceIdField));
        return $"{response.Content.Headers.ContentType}|{body.ToJsonString()}";
    }

    private static async Task ExecuteAsync(NpgsqlConnection connection, string sql, GroupWorld world)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("group", world.GroupId);
        if (sql.Contains("@user", StringComparison.Ordinal))
        {
            command.Parameters.AddWithValue("user", world.Users[A.CoAdmin]);
        }

        await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    private async Task<NpgsqlConnection> OpenAsync()
    {
        var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        return connection;
    }
}
