using System.Net;
using Sacou.Integration.Tests.Groups;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Matches;

/// <summary>
/// A7 of E3.7: above 256 KiB the body is refused with 413 and nothing is created (ADR 0060, D8 step 1). This runs on
/// Kestrel, the server that enforces the size limit of the endpoint (the TestServer does not).
/// </summary>
public sealed class CourtRequestSizeTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int MaxRequestBytes = 256 * 1024;

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync()
    {
        api.UseKestrel(0);
        await api.MigrateAsync();
    }

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task BodyOverTheCeiling_Is413_AndNothingIsCreated()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        var start = phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]);
        var body = CourtPhone.Body([start]);
        var padded = body[..^2] + new string(' ', MaxRequestBytes + 1 - body.Length) + "]}";

        using var refused = await world.SendAsync(A.Admin, HttpMethod.Post, CourtCalls.EventsPath(world, round, phone.CourtSessionId), padded);

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, refused.StatusCode);
        Assert.Equal(0, await CourtCalls.CountAsync(api.ConnectionString, "SELECT count(*) FROM matches.court_sessions WHERE id = @id", phone.CourtSessionId));
    }

    /// <summary>Exactly at the ceiling the body reaches the reader: whitespace is valid JSON, so the write goes through.</summary>
    [Fact]
    public async Task BodyAtTheCeiling_IsRead()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        var body = CourtPhone.Body([phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);
        var padded = body[..^2] + new string(' ', MaxRequestBytes - body.Length) + "]}";

        using var accepted = await world.SendAsync(A.Admin, HttpMethod.Post, CourtCalls.EventsPath(world, round, phone.CourtSessionId), padded);

        Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);
    }
}
