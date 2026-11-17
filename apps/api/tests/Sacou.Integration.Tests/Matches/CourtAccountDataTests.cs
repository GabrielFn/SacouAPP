using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Sacou.Integration.Tests.Groups;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Matches;

/// <summary>E1 of E3.7: the export carries the batches the person wrote and no one else's; the deletion keeps them (ADR 0060, D16).</summary>
public sealed class CourtAccountDataTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string ExportPath = "/v1/me/export";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task Export_HasTheOwnBatches_AndTheDeletionKeepsThem()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);

        var own = await CourtWritesAsync(world, A.Scorekeeper);
        var others = await CourtWritesAsync(world, A.Admin);

        var entry = Assert.Single(own);
        Assert.Equal(["batch", "courtSessionId", "deviceId", "roundId", "startedAt"], entry.Select(pair => pair.Key).Order(StringComparer.Ordinal));
        Assert.Equal(phone.CourtSessionId, entry["courtSessionId"]!.GetValue<Guid>());
        Assert.Equal(Guid.Parse(round), entry["roundId"]!.GetValue<Guid>());
        Assert.Equal(1, entry["batch"]!.GetValue<long>());
        Assert.Equal(phone.DeviceId, entry["deviceId"]!.GetValue<Guid>());
        Assert.Empty(others);

        using var deleted = await world.DeleteAccountAsync(A.Scorekeeper);

        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal(1, await CourtCalls.CountAsync(api.ConnectionString,
            $"SELECT count(*) FROM matches.court_writers WHERE court_session_id = @id AND member_id = '{world.MemberIds[A.Scorekeeper]}'", phone.CourtSessionId));
        Assert.Equal(1, await CourtCalls.EventCountAsync(api.ConnectionString, phone.CourtSessionId));
    }

    private static async Task<IReadOnlyList<JsonObject>> CourtWritesAsync(GroupWorld world, A actor)
    {
        using var response = await world.SendAsync(actor, HttpMethod.Get, ExportPath);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var document = await response.Content.ReadFromJsonAsync<JsonObject>(TestContext.Current.CancellationToken);
        return [.. document!["courtWrites"]!.AsArray().Select(item => item!.AsObject())];
    }
}
