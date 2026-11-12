using System.Net;
using Sacou.Integration.Tests.Groups;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Sessions;

/// <summary>
/// M4 of E3.4, body size: above the layer ceiling plus the envelope the server refuses the body before any handler runs. This runs on Kestrel,
/// the server that enforces the size limit of the endpoint (the TestServer does not).
/// </summary>
public sealed class RoundRequestSizeTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int OversizedBodyCharacters = 6_000;
    private const int LayerNearTheCeilingBytes = 4_090;

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync()
    {
        api.UseKestrel(0);
        await api.MigrateAsync();
    }

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task BodyOverTheCeilingAndTheEnvelope_IsRefusedWith413_AndNothingIsCreated()
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

    /// <summary>A layer of almost 4 KB gets the Groups' own refusal (400), not a 413 from the body limit.</summary>
    [Theory]
    [InlineData(HttpMethodName.Post)]
    [InlineData(HttpMethodName.Patch)]
    public async Task LayerNearTheCeiling_ReachesTheSettingsValidation(string method)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = (await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>();
        var layer = $$"""{"note":"{{new string('a', LayerNearTheCeilingBytes - 12)}}"}""";
        var (verb, path, body) = method == HttpMethodName.Post
            ? (HttpMethod.Post, RoundCalls.RoundsPath(world), $$"""{"localDate":"{{RoundCalls.FutureDate()}}","localTime":"20:30","venue":"Quadra 3","settings":{{layer}}}""")
            : (HttpMethod.Patch, RoundCalls.RoundPath(world, round), $$"""{"settings":{{layer}}}""");

        using var response = await world.SendAsync(A.Admin, verb, path, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("groups.settings-invalid", await RoundCalls.CodeAsync(response));
    }
}

/// <summary>Names for the theory data above.</summary>
internal static class HttpMethodName
{
    public const string Post = "POST";
    public const string Patch = "PATCH";
}
