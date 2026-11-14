using System.Net;
using Xunit;

namespace Sacou.Integration.Tests.Groups;

/// <summary>
/// The 4 KB cap on the guest writes (ADR 0053): over it the server answers 413 and nothing is created or changed.
/// It runs on Kestrel, the server that enforces the size limit of the endpoint (the TestServer does not).
/// </summary>
public sealed class GuestsRequestSizeTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int OversizedBodyCharacters = 5_000;

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync()
    {
        api.UseKestrel(0);
        await api.MigrateAsync();
    }

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task OversizedAddBody_IsRefusedWith413_AndCreatesNoGuest()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var json = $$"""{"requestId":"{{Guid.NewGuid()}}","name":"Léo","padding":"{{new string('x', OversizedBodyCharacters)}}"}""";

        using var response = await world.SendAsync(GroupActor.Admin, HttpMethod.Post, GuestCalls.GuestsPath(world), json);

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
        Assert.Equal(0, await GuestCalls.CountAsync(api.ConnectionString, world.GroupId));
    }

    [Fact]
    public async Task OversizedCorrectionBody_IsRefusedWith413_AndChangesNothing()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var guest = await GuestCalls.CreateAsync(world, "Léo");
        var json = $$"""{"name":"Leonardo","padding":"{{new string('x', OversizedBodyCharacters)}}"}""";

        using var response = await world.SendAsync(GroupActor.Admin, HttpMethod.Put, GuestCalls.GuestPath(world, guest), json);

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
        Assert.Equal("Léo", (await GuestCalls.ReadAsync(api.ConnectionString, guest))!.Name);
    }
}
