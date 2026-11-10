using System.Net;
using System.Text.Json.Nodes;
using Xunit;

namespace Sacou.Integration.Tests.Groups;

/// <summary>The settings routes as a test calls them, so each test reads as the story it tells.</summary>
internal static class SettingsCalls
{
    public const string PatchBestOf3 = """{"settings":{"schemaVersion":1,"scoring":{"bestOf":3}}}""";

    public static async Task<JsonObject> JsonAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        return JsonNode.Parse(text)!.AsObject();
    }

    public static async Task<string?> CodeAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        return response.IsSuccessStatusCode || text.Length == 0 ? null : JsonNode.Parse(text)?.AsObject()["code"]?.GetValue<string>();
    }

    public static async Task<JsonObject> GetAsync(GroupWorld world, string groupPath, GroupActor actor = GroupActor.Admin)
    {
        using var response = await world.SendAsync(actor, HttpMethod.Get, groupPath + "/settings");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await JsonAsync(response);
    }

    public static async Task<JsonObject> PatchAsync(GroupWorld world, string groupPath, string json, GroupActor actor = GroupActor.Admin)
    {
        using var response = await world.SendAsync(actor, HttpMethod.Patch, groupPath + "/settings", json);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await JsonAsync(response);
    }

    public static async Task<JsonObject> ApplyAsync(GroupWorld world, string groupPath, string json, GroupActor actor = GroupActor.Admin)
    {
        using var response = await world.SendAsync(actor, HttpMethod.Post, groupPath + "/settings/apply-template", json);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await JsonAsync(response);
    }

    public static async Task<Guid> SaveAsync(GroupWorld world, string groupPath, string name, GroupActor actor = GroupActor.Admin)
    {
        using var response = await world.SendAsync(actor, HttpMethod.Post, groupPath + "/templates", $$"""{"name":{{JsonValue.Create(name).ToJsonString()}}}""");
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await JsonAsync(response))["templateId"]!.GetValue<Guid>();
    }

    public static async Task<JsonArray> ListAsync(GroupWorld world, string groupPath, GroupActor actor = GroupActor.Admin)
    {
        using var response = await world.SendAsync(actor, HttpMethod.Get, groupPath + "/templates");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonNode.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!.AsArray();
    }

    /// <summary>A new group through the API, as the admin of the world, from a ready-made template.</summary>
    public static async Task<string> CreateGroupAsync(GroupWorld world, string templateKey)
    {
        using var response = await world.SendAsync(
            GroupActor.Admin, HttpMethod.Post, GroupWorld.GroupsPath, $$"""{"name":"Racha com modelo","templateKey":"{{templateKey}}"}""");
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return $"{GroupWorld.GroupsPath}/{(await JsonAsync(response))["groupId"]!.GetValue<Guid>()}";
    }

    /// <summary>The settings document of a response without the fields that change on every write.</summary>
    public static JsonNode Document(JsonObject response) => response["settings"]!.DeepClone();
}
