using System.Net;
using System.Text.Json.Nodes;
using Xunit;

namespace Sacou.Integration.Tests.Groups;

/// <summary>M1 to M3 of E3.2 on the real API and a real Postgres: who gets what, and what a non-member can learn.</summary>
public sealed class GroupsAuthorizationTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string TraceIdField = "traceId";
    private const string CodeField = "code";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Theory]
    [MemberData(nameof(AuthorizationMatrix.Rows), MemberType = typeof(AuthorizationMatrix))]
    public async Task Matrix_EveryActorOnEveryRoute(GroupActor actor, GroupRoute route, int status, string? code)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var (method, path, json) = AuthorizationMatrix.Request(world, route);

        using var response = await world.SendAsync(actor, method, path, json);

        Assert.Equal((HttpStatusCode)status, response.StatusCode);
        Assert.Equal(code, await CodeAsync(response));
    }

    [Fact]
    public void Matrix_HasOneRowPerActorAndRoute()
    {
        var pairs = AuthorizationMatrix.Rows.Select(row => (row.Data.Item1, row.Data.Item2)).ToHashSet();

        Assert.Equal(Enum.GetValues<GroupActor>().Length * Enum.GetValues<GroupRoute>().Length, pairs.Count);
        Assert.Equal(AuthorizationMatrix.Rows.Count, pairs.Count);
    }

    /// <summary>A refused rename changes nothing: the control is the admin's rename, in the same test.</summary>
    [Theory]
    [InlineData(GroupActor.Player)]
    [InlineData(GroupActor.NonMember)]
    [InlineData(GroupActor.LeftMember)]
    public async Task RefusedRename_KeepsTheName(GroupActor actor)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client, "Nome original");

        using var refused = await world.SendAsync(actor, HttpMethod.Patch, world.GroupPath, """{"name":"Invadido"}""");
        var before = await NameAsync(world);
        using var allowed = await world.SendAsync(GroupActor.Admin, HttpMethod.Patch, world.GroupPath, """{"name":"Nome novo"}""");

        Assert.NotEqual(HttpStatusCode.OK, refused.StatusCode);
        Assert.Equal("Nome original", before);
        Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
        Assert.Equal("Nome novo", await NameAsync(world));
    }

    /// <summary>M2: a missing group, someone else's, one I left and one I was removed from look the same, byte for byte.</summary>
    [Theory]
    [InlineData("GET", "")]
    [InlineData("PATCH", "")]
    [InlineData("GET", "/members")]
    public async Task NotFound_IsIdenticalForEveryKindOfNonMember(string method, string suffix)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var json = method == "PATCH" ? """{"name":"Qualquer"}""" : null;
        var missing = $"{GroupWorld.GroupsPath}/{Guid.NewGuid()}{suffix}";

        var bodies = new[]
        {
            await BodyAsync(world, GroupActor.NonMember, method, missing, json),
            await BodyAsync(world, GroupActor.OutsiderMember, method, world.GroupPath + suffix, json),
            await BodyAsync(world, GroupActor.LeftMember, method, world.GroupPath + suffix, json),
            await BodyAsync(world, GroupActor.RemovedMember, method, world.GroupPath + suffix, json),
            await BodyAsync(world, GroupActor.Admin, method, missing, json),
        };

        Assert.Single(bodies.Distinct(StringComparer.Ordinal));
        Assert.Contains("groups.group-not-found", bodies[0], StringComparison.Ordinal);
    }

    /// <summary>M3: an id that is not a GUID never matches a group route, so no handler or store runs.</summary>
    [Theory]
    [InlineData("/v1/groups/abc")]
    [InlineData("/v1/groups/abc/members")]
    public async Task MalformedGroupId_IsTheRouteNotFound(string path)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await world.SendAsync(GroupActor.Admin, HttpMethod.Get, path);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Null(await CodeAsync(response));
    }

    /// <summary>The route constraint reads a braced GUID as a GUID: it then gets the not-found of any missing group.</summary>
    [Fact]
    public async Task BracedGroupId_IsTheNotFoundOfAMissingGroup()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await world.SendAsync(GroupActor.Admin, HttpMethod.Get, $"{GroupWorld.GroupsPath}/%7B{Guid.NewGuid()}%7D/members");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("groups.group-not-found", await CodeAsync(response));
    }

    private static async Task<string?> CodeAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        return response.IsSuccessStatusCode || text.Length == 0
            ? null
            : JsonNode.Parse(text)?.AsObject()[CodeField]?.GetValue<string>();
    }

    private static async Task<string> BodyAsync(GroupWorld world, GroupActor actor, string method, string path, string? json)
    {
        using var response = await world.SendAsync(actor, new HttpMethod(method), path, json);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var body = JsonNode.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!.AsObject();
        Assert.True(body.Remove(TraceIdField));
        return $"{response.Content.Headers.ContentType}|{body.ToJsonString()}";
    }

    private static async Task<string> NameAsync(GroupWorld world)
    {
        using var response = await world.SendAsync(GroupActor.Admin, HttpMethod.Get, world.GroupPath);
        var body = JsonNode.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!;
        return body["name"]!.GetValue<string>();
    }
}
