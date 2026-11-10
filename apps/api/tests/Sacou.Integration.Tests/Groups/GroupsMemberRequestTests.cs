using System.Net;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Groups;

/// <summary>
/// M8 of E3.2: mass assignment, enums and body size on the member writes. Every refused body leaves the
/// member as it was; the control is an accepted body in the same test. The 413 runs on Kestrel, the server
/// that enforces the size limit of the endpoint (the TestServer does not).
/// </summary>
public sealed class GroupsMemberRequestTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int OversizedBodyCharacters = 5_000;

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync()
    {
        api.UseKestrel(0);
        await api.MigrateAsync();
    }

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Theory]
    [InlineData("""{"role":"admin","groupId":"00000000-0000-0000-0000-000000000000"}""")]
    [InlineData("""{"role":"admin","memberId":"00000000-0000-0000-0000-000000000000"}""")]
    [InlineData("""{"role":"admin","userId":"canario-123"}""")]
    [InlineData("""{"role":"admin","status":"active"}""")]
    [InlineData("""{"role":0}""")]
    [InlineData("""{"role":"1"}""")]
    [InlineData("""{"role":"owner"}""")]
    [InlineData("""{"role":null}""")]
    [InlineData("""{"role":"admin,player"}""")]
    [InlineData("""{"role":"admin, player"}""")]
    [InlineData("""{}""")]
    [InlineData("""{"role":"player","ROLE":"admin"}""")]
    [InlineData("""{"role":"canario-123""")]
    [InlineData("""[]""")]
    public async Task RefusedRoleBody_IsABareBadRequestAndChangesNothing(string json)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var path = world.MemberPath(world.MemberIds[A.Player]) + "/role";

        using var response = await world.SendAsync(A.Admin, HttpMethod.Put, path, json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.DoesNotContain("canario", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken), StringComparison.Ordinal);
        Assert.Equal("player", (await MemberRows.ReadAsync(api.ConnectionString, world.MemberIds[A.Player])).Role);
    }

    /// <summary>Names and enum values are read without regard to case (ADR 0039).</summary>
    [Theory]
    [InlineData("""{"role":"SCOREKEEPER"}""")]
    [InlineData("""{"Role":"scorekeeper"}""")]
    [InlineData("""{"ROLE":"Scorekeeper"}""")]
    public async Task RoleBody_IgnoresCase(string json)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await world.SendAsync(A.Admin, HttpMethod.Put, world.MemberPath(world.MemberIds[A.Player]) + "/role", json);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("scorekeeper", (await MemberRows.ReadAsync(api.ConnectionString, world.MemberIds[A.Player])).Role);
    }

    [Theory]
    [InlineData("""{"memberType":1}""")]
    [InlineData("""{"memberType":"monthly"}""")]
    [InlineData("""{"memberType":"regular,dropIn"}""")]
    [InlineData("""{"memberType":null}""")]
    [InlineData("""{}""")]
    [InlineData("""{"memberType":"regular","role":"admin"}""")]
    public async Task RefusedTypeBody_IsABadRequestAndChangesNothing(string json)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var path = world.MemberPath(world.MemberIds[A.Player]) + "/type";

        using var refused = await world.SendAsync(A.Admin, HttpMethod.Put, path, json);
        var before = await MemberRows.ReadAsync(api.ConnectionString, world.MemberIds[A.Player]);
        using var control = await world.SendAsync(A.Admin, HttpMethod.Put, path, """{"MemberType":"REGULAR"}""");

        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
        Assert.Equal(new MemberState("player", "drop_in", "active", HasLeftAt: false), before);
        Assert.Equal(HttpStatusCode.OK, control.StatusCode);
        Assert.Equal("regular", (await MemberRows.ReadAsync(api.ConnectionString, world.MemberIds[A.Player])).MemberType);
    }

    /// <summary>Above 4 KB the server refuses the body before any handler runs, on every group route that takes one.</summary>
    [Theory]
    [InlineData("POST", "")]
    [InlineData("PATCH", "{group}")]
    [InlineData("PUT", "{player}/role")]
    [InlineData("PUT", "{player}/type")]
    public async Task OversizedBody_IsRefusedByTheServer(string method, string route)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var path = route
            .Replace("{group}", world.GroupPath, StringComparison.Ordinal)
            .Replace("{player}", world.MemberPath(world.MemberIds[A.Player]), StringComparison.Ordinal);
        var json = $$"""{"name":"Racha","role":"admin","padding":"{{new string('x', OversizedBodyCharacters)}}"}""";

        using var response = await world.SendAsync(A.Admin, new HttpMethod(method), path.Length == 0 ? GroupWorld.GroupsPath : path, json);
        using var small = await world.SendAsync(A.Admin, HttpMethod.Get, world.GroupPath);

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, small.StatusCode);
        Assert.Equal("player", (await MemberRows.ReadAsync(api.ConnectionString, world.MemberIds[A.Player])).Role);
    }
}
