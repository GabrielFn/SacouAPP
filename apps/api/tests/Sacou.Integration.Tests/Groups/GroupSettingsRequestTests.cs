using System.Net;
using System.Text.Json.Nodes;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Groups;

/// <summary>
/// M4 of E3.3: mass assignment, wrong shapes and body size on the settings writes. Every refused body leaves
/// the settings as they were; the control is an accepted body in the same test. The 413 runs on Kestrel, the
/// server that enforces the size limit of the endpoint (the TestServer does not).
/// </summary>
public sealed class GroupSettingsRequestTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int OversizedBodyCharacters = 5_000;
    private const int GroupRouteBodyLimit = 4 * 1024;
    private const string SettingsInvalid = "groups.settings-invalid";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync()
    {
        api.UseKestrel(0);
        await api.MigrateAsync();
    }

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>A body the DTO or the catalog refuses: 400 with the code of the rule when the catalog is the one that refused.</summary>
    [Theory]
    [InlineData("""{"settings":{"schemaVersion":1,"templateKey":"treino"}}""", SettingsInvalid)]
    [InlineData("""{"settings":{"schemaVersion":1,"groupId":"00000000-0000-0000-0000-000000000000"}}""", SettingsInvalid)]
    [InlineData("""{"settings":{"schemaVersion":1,"scoring":{"updatedBy":"x"}}}""", SettingsInvalid)]
    [InlineData("""{"settings":{"schemaVersion":1,"scoring":{"bestOf":2}}}""", SettingsInvalid)]
    [InlineData("""{"settings":{"schemaVersion":1,"scoring":{"bestOf":"3"}}}""", SettingsInvalid)]
    [InlineData("""{"settings":{"schemaVersion":1,"scoring":{"bestOf":null}}}""", SettingsInvalid)]
    [InlineData("""{"settings":{"schemaVersion":1,"scoring":null}}""", SettingsInvalid)]
    [InlineData("""{"settings":{"schemaVersion":1,"scoring":{"pointsPerSet":25.5}}}""", SettingsInvalid)]
    [InlineData("""{"settings":{"schemaVersion":1,"attendance":{"capacity":1}}}""", SettingsInvalid)]
    [InlineData("""{"settings":{"schemaVersion":2,"scoring":{"bestOf":3}}}""", SettingsInvalid)]
    [InlineData("""{"settings":{"scoring":{"bestOf":3}}}""", SettingsInvalid)]
    [InlineData("""{"settings":{"schemaVersion":1,"schedule":{"venue":"Quadra\u0000"}}}""", SettingsInvalid)]
    [InlineData("""{"settings":{"schemaVersion":1,"schedule":{"venue":"Quadra​"}}}""", SettingsInvalid)]
    [InlineData("""{"settings":{"schemaVersion":1,"schedule":{"venue":"\ud800"}}}""", SettingsInvalid)]
    [InlineData("""{"settings":{"schemaVersion":1,"schedule":{"venue":"a","venue":"b"}}}""", SettingsInvalid)]
    [InlineData("""{"settings":{"schemaVersion":1,"scoring":{"bestOf":3,"bestOf":1}}}""", SettingsInvalid)]
    [InlineData("""{"settings":null}""", SettingsInvalid)]
    [InlineData("""{"settings":[]}""", SettingsInvalid)]
    [InlineData("""{"settings":"x"}""", SettingsInvalid)]
    [InlineData("""{}""", SettingsInvalid)]
    [InlineData("""{"settings":{"schemaVersion":1},"groupId":"00000000-0000-0000-0000-000000000000"}""", null)]
    [InlineData("""{"settings":{"schemaVersion":1},"memberId":"00000000-0000-0000-0000-000000000000"}""", null)]
    [InlineData("""{"settings":{"schemaVersion":1},"updatedBy":"00000000-0000-0000-0000-000000000000"}""", null)]
    [InlineData("""{"settings":{"schemaVersion":1},"templateKey":"treino"}""", null)]
    [InlineData("""{"settings":{"schemaVersion":1}""", null)]
    public async Task RefusedPatchBody_IsABadRequest_AndChangesNothing(string json, string? code)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var before = await SettingsCalls.GetAsync(world, world.GroupPath);

        using var refused = await world.SendAsync(A.Admin, HttpMethod.Patch, world.GroupPath + "/settings", json);
        var after = await SettingsCalls.GetAsync(world, world.GroupPath);
        var control = await SettingsCalls.PatchAsync(world, world.GroupPath, SettingsCalls.PatchBestOf3);

        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
        Assert.Equal(code, await SettingsCalls.CodeAsync(refused));
        Assert.True(JsonNode.DeepEquals(before, after));
        Assert.Equal(3, control["settings"]!["scoring"]!["bestOf"]!.GetValue<int>());
    }

    /// <summary>The whole document the API answers can be sent back as it is: it fits the 4 KB limit, venue of 80 characters included.</summary>
    [Fact]
    public async Task TheWholeDocument_CanBeSentBackAsAPatch()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var venue = new string('ç', 80);
        await SettingsCalls.PatchAsync(world, world.GroupPath, $$"""{"settings":{"schemaVersion":1,"schedule":{"venue":"{{venue}}"}}}""");
        var current = await SettingsCalls.GetAsync(world, world.GroupPath);

        var body = new JsonObject { ["settings"] = SettingsCalls.Document(current) }.ToJsonString();
        var patched = await SettingsCalls.PatchAsync(world, world.GroupPath, body);

        Assert.True(body.Length < GroupRouteBodyLimit);
        Assert.True(JsonNode.DeepEquals(SettingsCalls.Document(current), SettingsCalls.Document(patched)));
        Assert.Equal(venue, patched["settings"]!["schedule"]!["venue"]!.GetValue<string>());
    }

    /// <summary>Above 4 KB the server refuses the body before any handler runs, on every settings route that takes one.</summary>
    [Theory]
    [InlineData("PATCH", "/settings")]
    [InlineData("POST", "/settings/apply-template")]
    [InlineData("POST", "/templates")]
    public async Task OversizedBody_IsRefusedByTheServer(string method, string route)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var before = await SettingsCalls.GetAsync(world, world.GroupPath);
        var json = $$"""{"name":"Racha","padding":"{{new string('x', OversizedBodyCharacters)}}"}""";

        using var response = await world.SendAsync(A.Admin, new HttpMethod(method), world.GroupPath + route, json);

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
        Assert.True(JsonNode.DeepEquals(before, await SettingsCalls.GetAsync(world, world.GroupPath)));
        Assert.Empty(await SettingsCalls.ListAsync(world, world.GroupPath));
    }
}
