using System.Net;
using System.Text.Json.Nodes;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Sessions;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Matches;

/// <summary>
/// The snapshot of the court stream against a real Postgres (ADR 0081): what a rolled back write leaves, and the
/// requests that never read an envelope (the refusal of a phone that does not write, and the takeover).
/// </summary>
public sealed class CourtSnapshotTests(IntegrationDatabase database) : IAsyncLifetime
{
    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>A write that fails after its decision rolls back and keeps no snapshot with its events: the same event goes in after.</summary>
    [Fact]
    public async Task AWriteThatRollsBack_LeavesTheStreamAsItWas()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);
        var failing = Guid.NewGuid();
        var point = phone.Envelope(failing, "PointScored", $$"""{"matchId":"{{phone.MatchId}}","setNumber":1,"team":"a"}""");
        var trigger = $"refuse_{failing:N}";
        await CourtCalls.ExecuteAsync(api.ConnectionString, $$"""
            CREATE FUNCTION matches.{{trigger}}() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'refused by the test'; END $$;
            CREATE TRIGGER {{trigger}} BEFORE INSERT ON matches.court_events
            FOR EACH ROW WHEN (NEW.event_id = '{{failing}}') EXECUTE FUNCTION matches.{{trigger}}();
            """);
        try
        {
            using var failed = await CourtCalls.SendAsync(world, A.Scorekeeper, round, phone, [point]);
            Assert.Equal(HttpStatusCode.InternalServerError, failed.StatusCode);
        }
        finally
        {
            await CourtCalls.ExecuteAsync(api.ConnectionString, $"DROP TRIGGER {trigger} ON matches.court_events; DROP FUNCTION matches.{trigger}();");
        }

        Assert.Equal(1, await CourtCalls.EventCountAsync(api.ConnectionString, phone.CourtSessionId));
        Assert.Equal((2L, 1), await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [point]));
        Assert.Equal((3L, 1), await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [phone.Point("b")]));
    }

    /// <summary>
    /// A stored row the parser would refuse, after the snapshot: a phone that does not write is refused with its batch,
    /// the takeover gets the count of the row and the sequence of the device, and the former writer its last sequence,
    /// all with no 500, so none of them read an envelope.
    /// </summary>
    [Fact]
    public async Task TheRefusalOfAnotherPhone_AndTheTakeover_ReadNoEnvelope()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone,
            [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]), phone.Point("a"), phone.Point("b"), phone.Point("a")]);
        await CourtCalls.ExecuteAsync(api.ConnectionString,
            """
            INSERT INTO matches.court_events (court_session_id, position, event_id, batch, sequence, device_id, schema_version, type, envelope, received_at)
            VALUES (@id, 5, @eventId, 1, 5, @deviceId, 1, 'PointScored', '{"not":"an envelope"}', now());
            UPDATE matches.court_sessions SET event_count = 5 WHERE id = @id;
            """,
            ("id", phone.CourtSessionId), ("eventId", Guid.NewGuid()), ("deviceId", Guid.NewGuid()));
        var other = phone.TakingOver(batch: 2);

        using var refused = await CourtCalls.SendAsync(world, A.Admin, round, other, [other.Point("a")]);
        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        Assert.Equal("matches.not-the-writer", await RoundCalls.CodeAsync(refused));
        var taken = await CourtCalls.TakenOverAsync(world, A.Admin, round, other, expectedBatch: 1, expectedEventCount: 5);
        using var former = await CourtCalls.SendAsync(world, A.Scorekeeper, round, phone, [phone.Point("b")]);
        var formerBody = JsonNode.Parse(await former.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!.AsObject();

        Assert.Equal((2L, 5L, 0L, 5L), taken);
        Assert.Equal(HttpStatusCode.Conflict, former.StatusCode);
        Assert.Equal(2, formerBody["currentBatch"]!.GetValue<long>());
        Assert.Equal(4, formerBody["lastSequence"]!.GetValue<long>());
    }
}
