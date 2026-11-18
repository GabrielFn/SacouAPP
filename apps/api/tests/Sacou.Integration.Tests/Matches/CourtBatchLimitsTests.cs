using System.Net;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Sessions;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Matches;

/// <summary>E3.7 Part 2: the per-request limits (200 events, 16 KiB per envelope) answer with their own code, over HTTP.</summary>
public sealed class CourtBatchLimitsTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int MaxEvents = 200;
    private const int MaxEnvelopeBytes = 16 * 1024;

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task ExactlyTheEventLimit_IsAccepted()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        string[] batch = [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]), .. phone.AlternatingPoints(MaxEvents - 1)];

        Assert.Equal(((long)MaxEvents, MaxEvents), await CourtCalls.AcceptedAsync(world, A.Admin, round, phone, batch));
    }

    [Fact]
    public async Task OneOverTheEventLimit_IsRefused_AndNothingIsStored()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        string[] batch = [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]), .. phone.AlternatingPoints(MaxEvents)];

        using var refused = await CourtCalls.SendAsync(world, A.Admin, round, phone, batch);

        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
        Assert.Equal("matches.batch-invalid", await RoundCalls.CodeAsync(refused));
        Assert.Equal(0, await CourtCalls.EventCountAsync(api.ConnectionString, phone.CourtSessionId));
    }

    [Fact]
    public async Task EmptyBatch_IsRefused()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();

        using var refused = await CourtCalls.SendAsync(world, A.Admin, round, phone, []);

        Assert.Equal("matches.batch-invalid", await RoundCalls.CodeAsync(refused));
        Assert.Equal(0, await CourtCalls.CountAsync(api.ConnectionString, "SELECT count(*) FROM matches.court_sessions WHERE id = @id", phone.CourtSessionId));
    }

    [Fact]
    public async Task EnvelopeOverTheByteLimit_IsRefused_AndNothingIsStored()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        var start = phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]);
        var fat = start[..^1] + new string(' ', MaxEnvelopeBytes + 1 - start.Length) + "}";

        using var refused = await CourtCalls.SendAsync(world, A.Admin, round, phone, [fat]);

        Assert.Equal(MaxEnvelopeBytes + 1, System.Text.Encoding.UTF8.GetByteCount(fat));
        Assert.Equal("matches.event-too-large", await RoundCalls.CodeAsync(refused));
        Assert.Equal(0, await CourtCalls.EventCountAsync(api.ConnectionString, phone.CourtSessionId));
    }

    [Fact]
    public async Task EnvelopeAtTheByteLimit_IsNotTooLarge()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        var start = phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]);
        var exact = start[..^1] + new string(' ', MaxEnvelopeBytes - start.Length) + "}";

        using var response = await CourtCalls.SendAsync(world, A.Admin, round, phone, [exact]);

        Assert.NotEqual("matches.event-too-large", response.IsSuccessStatusCode ? null : await RoundCalls.CodeAsync(response));
    }
}
