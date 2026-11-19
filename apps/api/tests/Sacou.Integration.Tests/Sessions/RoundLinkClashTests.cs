using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Sacou.Integration.Tests.Groups;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Infrastructure;
using Xunit;

namespace Sacou.Integration.Tests.Sessions;

/// <summary>
/// Case 1 of the E3.12 plan against the real index: a weekly series whose first code is another round's is drawn again,
/// and its series row, already saved and then rolled back, goes in once with the second attempt.
/// </summary>
public sealed class RoundLinkClashTests(IntegrationDatabase database) : IAsyncLifetime
{
    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task Series_WhoseFirstCodeIsTaken_GoesInWithTheNextOne()
    {
        var generator = new RepeatingGenerator();
        await using var clashing = api.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
        {
            _ = services.RemoveAll<IRoundLinkCodeGenerator>();
            _ = services.AddSingleton<IRoundLinkCodeGenerator>(generator);
        }));
        using var client = clashing.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var (_, taken) = await RoundLinkCalls.RoundAsync(world);
        generator.Repeat(RoundLinkCode.TryParse(taken)!);

        using var response = await world.SendAsync(
            GroupActor.Admin, HttpMethod.Post, $"{world.GroupPath}/rounds", RoundCalls.CreateBody(RoundCalls.FutureDate(4), repeat: true));
        var created = await RoundCalls.JsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(created["seriesId"]);
        Assert.NotEqual(taken, RoundLinkCalls.CodeOf(created));
        Assert.Equal(0, generator.PendingRepeats);
    }

    /// <summary>Random codes, except a repeated one handed out once when asked.</summary>
    private sealed class RepeatingGenerator : IRoundLinkCodeGenerator
    {
        private readonly RandomRoundLinkCodeGenerator random = new();
        private RoundLinkCode? repeated;

        public int PendingRepeats => repeated is null ? 0 : 1;

        public void Repeat(RoundLinkCode code) => Volatile.Write(ref repeated, code);

        public RoundLinkCode NewCode() => Interlocked.Exchange(ref repeated, null) ?? random.NewCode();
    }
}
