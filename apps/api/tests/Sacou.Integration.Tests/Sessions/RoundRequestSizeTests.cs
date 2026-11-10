using System.Net;
using Sacou.Integration.Tests.Groups;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Sessions;

/// <summary>
/// M4 of E3.4, body size: above 4 KB the server refuses the body before any handler runs. This runs on Kestrel,
/// the server that enforces the size limit of the endpoint (the TestServer does not).
/// </summary>
public sealed class RoundRequestSizeTests(IntegrationDatabase database) : IAsyncLifetime
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
    public async Task BodyOverFourKilobytes_IsRefusedWith413_AndNothingIsCreated()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var big = $$"""{"localDate":"{{RoundCalls.FutureDate()}}","localTime":"20:30","venue":"{{new string('a', OversizedBodyCharacters)}}"}""";

        using var refused = await world.SendAsync(A.Admin, HttpMethod.Post, RoundCalls.RoundsPath(world), big);
        using var list = await world.SendAsync(A.Admin, HttpMethod.Get, RoundCalls.RoundsPath(world));

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, refused.StatusCode);
        Assert.Empty(await RoundCalls.JsonAsyncArray(list));
        _ = await RoundCalls.CreateAsync(world);
    }
}
