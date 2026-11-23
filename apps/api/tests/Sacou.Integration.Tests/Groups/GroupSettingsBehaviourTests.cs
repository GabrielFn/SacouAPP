using System.Net;
using System.Text.Json.Nodes;
using Npgsql;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Groups;

/// <summary>M6 to M9, P5, P6 and L1 of E3.3: the flow of a group's settings and templates, on the real API and a real Postgres.</summary>
public sealed class GroupSettingsBehaviourTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int TemplateCeiling = 20;
    private const string SettingsInvalid = "groups.settings-invalid";
    private const string FactsPatch =
        """{"settings":{"schemaVersion":1,"money":{"monthlyFeeCents":2500},"schedule":{"venue":"Quadra do Zé","weekday":3}}}""";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>M6: create from a template, change one leaf, save, apply another template (facts stay), apply the saved one.</summary>
    [Fact]
    public async Task Flow_FromTemplateToPatchToSavedTemplate()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var group = await SettingsCalls.CreateGroupAsync(world, "racha-organizado");

        var created = await SettingsCalls.GetAsync(world, group);
        var patched = await SettingsCalls.PatchAsync(world, group, SettingsCalls.PatchBestOf3);
        var withFacts = await SettingsCalls.PatchAsync(world, group, FactsPatch);
        var savedId = await SettingsCalls.SaveAsync(world, group, "Meu racha");
        var blank = await SettingsCalls.ApplyAsync(world, group, """{"templateKey":"do-zero"}""");
        var restored = await SettingsCalls.ApplyAsync(world, group, $$"""{"savedTemplateId":"{{savedId}}"}""");

        Assert.Equal("racha-organizado", created["templateKey"]!.GetValue<string>());
        Assert.Null(created["savedTemplateId"]);
        Assert.Equal(1, created["schemaVersion"]!.GetValue<int>());
        Assert.NotEqual(3, created["settings"]!["scoring"]!["bestOf"]!.GetValue<int>());
        Assert.Equal(3, patched["settings"]!["scoring"]!["bestOf"]!.GetValue<int>());
        Assert.Equal("racha-organizado", patched["templateKey"]!.GetValue<string>());
        Assert.Equal(OnlyChange(created, "scoring", "bestOf", 3), SettingsCalls.Document(patched).ToJsonString());
        Assert.Equal("do-zero", blank["templateKey"]!.GetValue<string>());
        Assert.NotEqual(3, blank["settings"]!["scoring"]!["bestOf"]!.GetValue<int>());
        Assert.Equal(2500, blank["settings"]!["money"]!["monthlyFeeCents"]!.GetValue<int>());
        Assert.Equal("Quadra do Zé", blank["settings"]!["schedule"]!["venue"]!.GetValue<string>());
        Assert.Equal(savedId, restored["savedTemplateId"]!.GetValue<Guid>());
        Assert.Null(restored["templateKey"]);
        Assert.True(JsonNode.DeepEquals(SettingsCalls.Document(withFacts), SettingsCalls.Document(restored)));
    }

    /// <summary>The group's label points at the saved template until it is deleted, and then it is cleared in the same write.</summary>
    [Fact]
    public async Task DeletingTheAppliedTemplate_ClearsTheLabel()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var savedId = await SettingsCalls.SaveAsync(world, world.GroupPath, "Aplicado");
        var applied = await SettingsCalls.ApplyAsync(world, world.GroupPath, $$"""{"savedTemplateId":"{{savedId}}"}""");

        using var first = await world.SendAsync(A.Admin, HttpMethod.Delete, $"{world.GroupPath}/templates/{savedId}");
        using var second = await world.SendAsync(A.Admin, HttpMethod.Delete, $"{world.GroupPath}/templates/{savedId}");
        var after = await SettingsCalls.GetAsync(world, world.GroupPath);

        Assert.Equal(savedId, applied["savedTemplateId"]!.GetValue<Guid>());
        Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, second.StatusCode);
        Assert.Equal("groups.template-not-found", await SettingsCalls.CodeAsync(second));
        Assert.Null(after["savedTemplateId"]);
        Assert.Null(after["templateKey"]);
        Assert.Empty(await SettingsCalls.ListAsync(world, world.GroupPath));
    }

    /// <summary>R98 part 4: the rules typed with the name are saved in the same call; a bad layer creates no group.</summary>
    [Fact]
    public async Task CreateGroup_WithASettingsLayerSavesItAtOnce_AndABadLayerCreatesNothing()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var user = world.Users[A.NonMember];
        var groups = await CountGroupsAsync(user);

        using var bad = await world.SendAsync(A.NonMember, HttpMethod.Post, GroupWorld.GroupsPath, """{"name":"Camada ruim","settings":{"schemaVersion":1,"scoring":{"bestOf":2}}}""");
        var afterBad = await CountGroupsAsync(user);
        using var good = await world.SendAsync(A.NonMember, HttpMethod.Post, GroupWorld.GroupsPath, """{"name":"Camada boa","templateKey":"racha-organizado","settings":{"schemaVersion":1,"scoring":{"bestOf":3}}}""");
        var path = $"{GroupWorld.GroupsPath}/{(await SettingsCalls.JsonAsync(good))["groupId"]!.GetValue<Guid>()}";
        var settings = await SettingsCalls.GetAsync(world, path, A.NonMember);

        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        Assert.Equal(groups, afterBad);
        Assert.Equal(HttpStatusCode.Created, good.StatusCode);
        Assert.Equal(3, settings["settings"]!["scoring"]!["bestOf"]!.GetValue<int>());
        Assert.Equal("racha-organizado", settings["templateKey"]!.GetValue<string>());
    }

    /// <summary>R98 part 4: an explicit null layer is the same as no layer (the model alone).</summary>
    [Fact]
    public async Task CreateGroup_WithAnExplicitNullSettingsCreatesTheGroupWithTheModel()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var created = await world.SendAsync(A.NonMember, HttpMethod.Post, GroupWorld.GroupsPath, """{"name":"Camada nula","settings":null}""");
        var path = $"{GroupWorld.GroupsPath}/{(await SettingsCalls.JsonAsync(created))["groupId"]!.GetValue<Guid>()}";
        var settings = await SettingsCalls.GetAsync(world, path, A.NonMember);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal("do-zero", settings["templateKey"]!.GetValue<string>());
    }

    /// <summary>R98 part 4: the same layer gets the same answer on POST and on PATCH (money included).</summary>
    [Fact]
    public async Task CreateGroup_AndPatchAnswerTheSameForTheSameLayer()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        const string layer = """{"schemaVersion":1,"money":{"monthlyFeeCents":2500}}""";
        const string badLayer = """{"schemaVersion":1,"money":{"monthlyFeeCents":-1}}""";

        using var post = await world.SendAsync(A.NonMember, HttpMethod.Post, GroupWorld.GroupsPath, $$"""{"name":"Com dinheiro","settings":{{layer}}}""");
        using var badPost = await world.SendAsync(A.NonMember, HttpMethod.Post, GroupWorld.GroupsPath, $$"""{"name":"Dinheiro ruim","settings":{{badLayer}}}""");
        using var patch = await world.SendAsync(A.Admin, HttpMethod.Patch, $"{world.GroupPath}/settings", $$"""{"settings":{{layer}}}""");
        using var badPatch = await world.SendAsync(A.Admin, HttpMethod.Patch, $"{world.GroupPath}/settings", $$"""{"settings":{{badLayer}}}""");

        Assert.Equal(patch.IsSuccessStatusCode, post.IsSuccessStatusCode);
        Assert.Equal(badPatch.StatusCode, badPost.StatusCode);
    }

    /// <summary>M7: without a key the group is "Do zero"; an unknown key is a 400 and no group is created.</summary>
    [Fact]
    public async Task CreateGroup_WithoutKeyIsDoZero_AndWithAnUnknownKeyCreatesNothing()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var user = world.Users[A.NonMember];

        using var plain = await world.SendAsync(A.NonMember, HttpMethod.Post, GroupWorld.GroupsPath, """{"name":"Sem modelo"}""");
        var groups = await CountGroupsAsync(user);
        using var unknown = await world.SendAsync(A.NonMember, HttpMethod.Post, GroupWorld.GroupsPath, """{"name":"Modelo errado","templateKey":"inexistente"}""");
        using var empty = await world.SendAsync(A.NonMember, HttpMethod.Post, GroupWorld.GroupsPath, """{"name":"Modelo vazio","templateKey":""}""");
        var plainPath = $"{GroupWorld.GroupsPath}/{(await SettingsCalls.JsonAsync(plain))["groupId"]!.GetValue<Guid>()}";
        var settings = await SettingsCalls.GetAsync(world, plainPath, A.NonMember);

        Assert.Equal(HttpStatusCode.Created, plain.StatusCode);
        Assert.Equal("do-zero", settings["templateKey"]!.GetValue<string>());
        Assert.False(settings["settings"]!["attendance"]!["enabled"]!.GetValue<bool>());
        Assert.Equal(HttpStatusCode.BadRequest, unknown.StatusCode);
        Assert.Equal("groups.template-not-found", await SettingsCalls.CodeAsync(unknown));
        Assert.Equal(HttpStatusCode.BadRequest, empty.StatusCode);
        Assert.Equal(groups, await CountGroupsAsync(user));
        Assert.Equal(1, await CountSettingsRowsAsync(plainPath));
    }

    /// <summary>M8: 20 saved templates pass, the 21st is a 409, and deleting one makes room.</summary>
    [Fact]
    public async Task TwentySavedTemplates_AreTheCeiling()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        Guid first = default;
        for (var index = 0; index < TemplateCeiling; index++)
        {
            var id = await SettingsCalls.SaveAsync(world, world.GroupPath, $"Modelo {index}");
            first = index == 0 ? id : first;
        }

        using var refused = await world.SendAsync(A.Admin, HttpMethod.Post, world.GroupPath + "/templates", """{"name":"Demais"}""");
        using var deleted = await world.SendAsync(A.Admin, HttpMethod.Delete, $"{world.GroupPath}/templates/{first}");
        var again = await SettingsCalls.SaveAsync(world, world.GroupPath, "Cabe de novo");

        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        Assert.Equal("groups.template-limit", await SettingsCalls.CodeAsync(refused));
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal(TemplateCeiling, (await SettingsCalls.ListAsync(world, world.GroupPath)).Count);
        Assert.NotEqual(Guid.Empty, again);
    }

    [Theory]
    [InlineData("""{"name":""}""")]
    [InlineData("""{"name":"   "}""")]
    [InlineData("""{"name":null}""")]
    [InlineData("""{}""")]
    public async Task SaveTemplate_RefusesAnInvalidName(string json)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await world.SendAsync(A.Admin, HttpMethod.Post, world.GroupPath + "/templates", json);
        var forty = await SettingsCalls.SaveAsync(world, world.GroupPath, new string('a', 40));
        using var tooLong = await world.SendAsync(A.Admin, HttpMethod.Post, world.GroupPath + "/templates", $$"""{"name":"{{new string('a', 41)}}"}""");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("groups.template-name-invalid", await SettingsCalls.CodeAsync(response));
        Assert.NotEqual(Guid.Empty, forty);
        Assert.Equal("groups.template-name-invalid", await SettingsCalls.CodeAsync(tooLong));
    }

    [Theory]
    [InlineData("""{}""")]
    [InlineData("""{"templateKey":"treino","savedTemplateId":"00000000-0000-0000-0000-000000000001"}""")]
    public async Task ApplyTemplate_NeedsExactlyOneId(string json)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await world.SendAsync(A.Admin, HttpMethod.Post, world.GroupPath + "/settings/apply-template", json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(SettingsInvalid, await SettingsCalls.CodeAsync(response));
    }

    [Fact]
    public async Task ApplyTemplate_WithAnUnknownKey_IsNotFound()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await world.SendAsync(A.Admin, HttpMethod.Post, world.GroupPath + "/settings/apply-template", """{"templateKey":"inexistente"}""");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("groups.template-not-found", await SettingsCalls.CodeAsync(response));
    }

    /// <summary>M9: nothing in the answers names a member, a user or an e-mail.</summary>
    [Fact]
    public async Task Responses_NeverCarryMembersUsersOrEmails()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var id = await SettingsCalls.SaveAsync(world, world.GroupPath, "Modelo");
        using var save = await world.SendAsync(A.Admin, HttpMethod.Post, world.GroupPath + "/templates", """{"name":"Outro"}""");
        var settings = await SettingsCalls.GetAsync(world, world.GroupPath);
        var listed = await SettingsCalls.ListAsync(world, world.GroupPath);

        Assert.Equal(["savedTemplateId", "schemaVersion", "settings", "templateKey", "updatedAt"], Keys(settings));
        Assert.All(listed, item => Assert.Equal(["createdAt", "name", "templateId"], Keys(item!.AsObject())));
        Assert.Equal(["createdAt", "name", "templateId"], Keys(await SettingsCalls.JsonAsync(save)));
        Assert.NotEqual(Guid.Empty, id);
    }

    /// <summary>P6: a group made before the settings existed reads as "Do zero", and its first write creates the row.</summary>
    [Fact]
    public async Task GroupWithoutARow_ReadsAsDoZero_AndTheFirstPatchCreatesIt()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await ExecuteAsync("DELETE FROM groups.group_settings WHERE group_id = @group", world.GroupId);

        var legacy = await SettingsCalls.GetAsync(world, world.GroupPath);
        var rowsBefore = await CountSettingsRowsAsync(world.GroupPath);
        var patched = await SettingsCalls.PatchAsync(world, world.GroupPath, SettingsCalls.PatchBestOf3);

        Assert.Null(legacy["templateKey"]);
        Assert.False(legacy["settings"]!["scoring"]!["enabled"]!.GetValue<bool>());
        Assert.Equal(0, rowsBefore);
        Assert.Equal(3, patched["settings"]!["scoring"]!["bestOf"]!.GetValue<int>());
        Assert.Equal(1, await CountSettingsRowsAsync(world.GroupPath));
    }

    /// <summary>P5: a row that does not parse is a generic 500, and the log carries the group id only, never the content.</summary>
    [Fact]
    public async Task StoredDocumentThatDoesNotParse_Is500_AndNeverLogsItsContent()
    {
        const string Secret = "SEGREDO-DA-QUADRA";
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var broken = new JsonObject { ["schemaVersion"] = 1, ["schedule"] = new JsonObject { ["venue"] = Secret } }.ToJsonString();
        await ExecuteAsync($"UPDATE groups.group_settings SET settings = '{broken}'::jsonb WHERE group_id = @group", world.GroupId);

        using var response = await world.SendAsync(A.Admin, HttpMethod.Get, world.GroupPath + "/settings");
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.DoesNotContain(Secret, text, StringComparison.Ordinal);
        Assert.DoesNotContain(api.Logs.Entries, entry => entry.Contains(Secret, StringComparison.Ordinal));
        Assert.Contains(api.Logs.Entries, entry => entry.Contains(world.GroupId.ToString(), StringComparison.Ordinal));
    }

    /// <summary>L1: no log entry carries a template name, the venue or the document.</summary>
    [Fact]
    public async Task Logs_NeverCarryTemplateNamesVenuesOrTheDocument()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var start = api.Logs.Count;

        await SettingsCalls.PatchAsync(world, world.GroupPath, """{"settings":{"schemaVersion":1,"schedule":{"venue":"Quadra da Fulana"}}}""");
        await SettingsCalls.SaveAsync(world, world.GroupPath, "Modelo da Fulana");
        using var refused = await world.SendAsync(A.Admin, HttpMethod.Patch, world.GroupPath + "/settings", """{"settings":{"schemaVersion":1,"schedule":{"venue":"Fulana\u0000"}}}""");
        using var forbidden = await world.SendAsync(A.Player, HttpMethod.Post, world.GroupPath + "/templates", """{"name":"Modelo da Fulana 2"}""");

        var logged = api.Logs.EntriesSince(start);

        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
        Assert.DoesNotContain(logged, entry => entry.Contains("Fulana", StringComparison.OrdinalIgnoreCase) || entry.Contains("schemaVersion", StringComparison.Ordinal));
    }

    private static List<string> Keys(JsonObject json) => [.. json.Select(field => field.Key).Order(StringComparer.Ordinal)];

    /// <summary>The response document with one leaf changed, as the string the next response must equal.</summary>
    private static string OnlyChange(JsonObject response, string block, string leaf, int value)
    {
        var copy = SettingsCalls.Document(response);
        copy[block]![leaf] = value;
        return copy.ToJsonString();
    }

    private async Task<long> CountGroupsAsync(Guid user) =>
        await ScalarAsync("SELECT count(*) FROM groups.members WHERE user_id = @id", user);

    private async Task<long> CountSettingsRowsAsync(string groupPath) =>
        await ScalarAsync("SELECT count(*) FROM groups.group_settings WHERE group_id = @id", Guid.Parse(groupPath[(groupPath.LastIndexOf('/') + 1)..]));

    private async Task<long> ScalarAsync(string sql, Guid id)
    {
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("id", id);
        return (long)(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
    }

    private async Task ExecuteAsync(string sql, Guid group)
    {
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("group", group);
        await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }
}
