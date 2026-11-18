using System.Net;
using System.Text.Json.Nodes;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Sessions;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Matches;

/// <summary>A5 and A6 of E3.8 (ADR 0063, D5 to D7): the summary of the round's stream and the read of the stored stream.</summary>
public sealed class CourtSessionReadTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int PageEvents = 500;
    private const int MaxPerWrite = 200;

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>A5: the score and the time of the last point match what was stored; a match that ended has no scoreboard; no device id.</summary>
    [Fact]
    public async Task TheSummary_ShowsTheStoredScore_AndNoDevice()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        using var none = await world.SendAsync(A.Admin, HttpMethod.Get, CourtCalls.SummaryPath(world, round));
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone,
            [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]), phone.Point("a"), phone.Point("a"), phone.Point("b")]);

        using var response = await world.SendAsync(A.Admin, HttpMethod.Get, CourtCalls.SummaryPath(world, round));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        var summary = JsonNode.Parse(text)!.AsObject();
        var lastReceived = await LastReceivedAtAsync(phone.CourtSessionId);
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [phone.ManualEnd()]);
        var ended = await CourtCalls.SummaryAsync(world, A.Admin, round);

        Assert.Equal(HttpStatusCode.NotFound, none.StatusCode);
        Assert.Equal("matches.court-session-not-found", await RoundCalls.CodeAsync(none));
        Assert.Equal("no-store", response.Headers.CacheControl!.ToString());
        Assert.Equal(["courtSessionId", "currentBatch", "eventCount", "lastEventAt", "scoreboard", "writer"], summary.Select(pair => pair.Key).Order(StringComparer.Ordinal));
        Assert.Equal(phone.CourtSessionId, summary["courtSessionId"]!.GetValue<Guid>());
        Assert.Equal(4, summary["eventCount"]!.GetValue<int>());
        Assert.Equal(["memberId", "since"], summary["writer"]!.AsObject().Select(pair => pair.Key).Order(StringComparer.Ordinal));
        Assert.Equal(lastReceived, summary["lastEventAt"]!.GetValue<DateTimeOffset>());
        var board = summary["scoreboard"]!.AsObject();
        Assert.Equal(phone.MatchId, board["matchId"]!.GetValue<Guid>());
        Assert.Equal((1, 2, 1, 0, 0), (board["setNumber"]!.GetValue<int>(), board["pointsA"]!.GetValue<int>(), board["pointsB"]!.GetValue<int>(),
            board["setsA"]!.GetValue<int>(), board["setsB"]!.GetValue<int>()));
        Assert.DoesNotContain(phone.DeviceId.ToString(), text, StringComparison.OrdinalIgnoreCase);
        Assert.Null(ended["scoreboard"]);
        Assert.Equal(5, ended["eventCount"]!.GetValue<int>());
    }

    /// <summary>A6: pages of 500, a read from the middle and past the end, and each envelope byte for byte as it was sent.</summary>
    [Fact]
    public async Task TheStream_IsReadInPages_AsItWasSent()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        List<string> sent = [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]), .. phone.AlternatingPoints(600)];
        foreach (var piece in sent.Chunk(MaxPerWrite))
        {
            _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, piece);
        }

        var first = await PageAsync(world, round, phone, "");
        var middle = await PageAsync(world, round, phone, "?after=500");
        var end = await PageAsync(world, round, phone, "?after=601");
        var past = await PageAsync(world, round, phone, "?after=9999");

        Assert.Equal($$"""{"events":[{{string.Join(',', sent.Take(PageEvents))}}],"lastPosition":500,"eventCount":601}""", first);
        Assert.Equal($$"""{"events":[{{string.Join(',', sent.Skip(PageEvents))}}],"lastPosition":601,"eventCount":601}""", middle);
        Assert.Equal("""{"events":[],"lastPosition":601,"eventCount":601}""", end);
        Assert.Equal(end, past);
    }

    [Theory]
    [InlineData("-1")]
    [InlineData("+1")]
    [InlineData("1.5")]
    [InlineData("abc")]
    [InlineData("99999999999999999999")]
    public async Task AnInvalidPosition_IsRefused(string after)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);

        using var refused = await world.SendAsync(A.Admin, HttpMethod.Get, $"{CourtCalls.EventsPath(world, round, Guid.NewGuid())}?after={Uri.EscapeDataString(after)}");
        var text = await refused.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
        Assert.Equal("matches.position-invalid", JsonNode.Parse(text)!["code"]!.GetValue<string>());
        Assert.DoesNotContain("99999999999999999999", text, StringComparison.Ordinal);
    }

    private static async Task<string> PageAsync(GroupWorld world, string round, CourtPhone phone, string query)
    {
        using var response = await world.SendAsync(A.CoAdmin, HttpMethod.Get, CourtCalls.EventsPath(world, round, phone.CourtSessionId) + query);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Assert.True(response.StatusCode == HttpStatusCode.OK, text);
        Assert.Equal("no-store", response.Headers.CacheControl!.ToString());
        return text;
    }

    private async Task<DateTimeOffset> LastReceivedAtAsync(Guid courtSessionId)
    {
        var ticks = await CourtCalls.CountAsync(api.ConnectionString,
            "SELECT (extract(epoch FROM max(received_at)) * 1000000)::bigint FROM matches.court_events WHERE court_session_id = @id", courtSessionId);
        const long TicksPerMicrosecond = 10;
        return DateTimeOffset.UnixEpoch.AddTicks(ticks * TicksPerMicrosecond);
    }
}
