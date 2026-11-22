using System.Net;
using System.Text.Json.Nodes;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Sessions;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Matches;

/// <summary>
/// E3.8 (ADR 0063): the acceptance A1, the role asked again under the lock (A3), the undo across the takeover (A7, the
/// accepted risk of answer 74), the canceled round (A8), the export (A9), the logs (L1), the ceiling of batches and the
/// takeover body.
/// </summary>
public sealed class CourtTakeoverTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string NotTheWriter = "matches.not-the-writer";
    private const string TakeoverInvalid = "matches.takeover-invalid";
    private const int PointsOfA = 9;
    private const int EventsOfA = 1 + PointsOfA;

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>
    /// A1: A writes 10 events; B reads the summary, takes over with the count it saw and gets batch 2; the 3 points A
    /// marked offline are refused with the batch and A's last stored sequence, and nothing of them is stored; B writes
    /// batch 2. A phone that never wrote learns only the batch.
    /// </summary>
    [Fact]
    public async Task TheOldPhone_IsRefusedAfterTheTakeover_AndTheNewOneWritesTheNextBatch()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phoneA = CourtPhone.New();
        string[] sentByA = [phoneA.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]), .. phoneA.AlternatingPoints(PointsOfA)];
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phoneA, sentByA);

        var summary = await CourtCalls.SummaryAsync(world, A.CoAdmin, round);
        var phoneB = phoneA.TakingOver(batch: 2);
        var taken = await CourtCalls.TakenOverAsync(world, A.CoAdmin, round, phoneB, summary["currentBatch"]!.GetValue<long>(), summary["eventCount"]!.GetValue<long>());
        using var refused = await CourtCalls.SendAsync(world, A.Scorekeeper, round, phoneA, phoneA.AlternatingPoints(3));
        var refusedBody = await RoundCalls.JsonAsync(refused);
        var stranger = phoneA.OtherDevice();
        using var strangerRefused = await CourtCalls.SendAsync(world, A.Admin, round, stranger, [stranger.Point("a")]);
        var strangerBody = await RoundCalls.JsonAsync(strangerRefused);
        string[] sentByB = [phoneB.Point("a"), phoneB.Point("b")];
        var written = await CourtCalls.AcceptedAsync(world, A.CoAdmin, round, phoneB, sentByB);

        Assert.Equal(1, summary["currentBatch"]!.GetValue<long>());
        Assert.Equal(EventsOfA, summary["eventCount"]!.GetValue<int>());
        Assert.Equal(world.MemberIds[A.Scorekeeper], summary["writer"]!["memberId"]!.GetValue<Guid>());
        Assert.Equal((2L, (long)EventsOfA, 0L, (long)EventsOfA), taken);
        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        Assert.Equal(NotTheWriter, refusedBody["code"]!.GetValue<string>());
        Assert.Equal(2, refusedBody["currentBatch"]!.GetValue<long>());
        Assert.Equal(EventsOfA, refusedBody["lastSequence"]!.GetValue<long>());
        Assert.Equal(HttpStatusCode.Conflict, strangerRefused.StatusCode);
        Assert.Equal(2, strangerBody["currentBatch"]!.GetValue<long>());
        Assert.False(strangerBody.ContainsKey("lastSequence"));
        Assert.Equal((2L, 2), written);
        Assert.Equal([.. sentByA, .. sentByB], await CourtCalls.StoredEnvelopesAsync(api.ConnectionString, phoneA.CourtSessionId));
        Assert.Equal(2, await CourtCalls.CountAsync(api.ConnectionString,
            $"SELECT count(*) FROM matches.court_events WHERE court_session_id = @id AND batch = 2 AND device_id = '{phoneB.DeviceId}'", phoneA.CourtSessionId));
    }

    /// <summary>A3: a co-admin made a player between the access filter and the stream's lock does not take the court.</summary>
    [Fact]
    public async Task ACoAdminDemotedBeforeTheLock_DoesNotTakeOver()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);
        const int UnderTheLock = 2;
        api.BeforeMembershipLookup = lookup => lookup == UnderTheLock
            ? CourtCalls.ExecuteAsync(api.ConnectionString, "UPDATE groups.members SET role = 'player' WHERE id = @member", ("member", world.MemberIds[A.CoAdmin]))
            : Task.CompletedTask;

        using var refused = await CourtCalls.TakeOverAsync(world, A.CoAdmin, round, phone.TakingOver(batch: 2), expectedBatch: 1, expectedEventCount: 1);
        api.BeforeMembershipLookup = null;

        Assert.Equal(HttpStatusCode.Forbidden, refused.StatusCode);
        Assert.Equal(RoundCalls.Forbidden, await RoundCalls.CodeAsync(refused));
        Assert.Equal(1, await WritersAsync(phone.CourtSessionId));
    }

    /// <summary>
    /// A7 (answer 74, accepted risk): who took the court over undoes back to a point of the old phone; the undone events
    /// stay stored, and the undo is in the batch of the member who did it. The summary shows the reverted score.
    /// </summary>
    [Fact]
    public async Task TheNewWriter_UndoesBeforeTheTakeover_AndTheAuthorshipIsKept()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phoneA = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phoneA,
            [phoneA.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]), .. phoneA.AlternatingPoints(PointsOfA)]);
        var phoneB = phoneA.TakingOver(batch: 2);
        _ = await CourtCalls.TakenOverAsync(world, A.CoAdmin, round, phoneB, 1, EventsOfA);
        const int FifthEvent = 4;
        var target = JsonNode.Parse((await CourtCalls.StoredEnvelopesAsync(api.ConnectionString, phoneA.CourtSessionId))[FifthEvent])!["eventId"]!.GetValue<Guid>();

        var written = await CourtCalls.AcceptedAsync(world, A.CoAdmin, round, phoneB, [phoneB.RevertedTo(target)]);
        var summary = await CourtCalls.SummaryAsync(world, A.Admin, round);

        Assert.Equal((1L, 1), written);
        Assert.Equal(EventsOfA + 1, await CourtCalls.EventCountAsync(api.ConnectionString, phoneA.CourtSessionId));
        Assert.Equal(1, await CourtCalls.CountAsync(api.ConnectionString,
            $"SELECT count(*) FROM matches.court_events WHERE court_session_id = @id AND event_id = '{target}'", phoneA.CourtSessionId));
        Assert.Equal(1, await CourtCalls.CountAsync(api.ConnectionString,
            $"""
            SELECT count(*) FROM matches.court_events e JOIN matches.court_writers w ON w.court_session_id = e.court_session_id AND w.batch = e.batch
            WHERE e.court_session_id = @id AND e.type = 'RevertedTo' AND e.batch = 2 AND w.member_id = '{world.MemberIds[A.CoAdmin]}'
            """, phoneA.CourtSessionId));
        Assert.Equal(2, summary["scoreboard"]!["pointsA"]!.GetValue<int>());
        Assert.Equal(2, summary["scoreboard"]!["pointsB"]!.GetValue<int>());
    }

    /// <summary>A8: the stream of a canceled round is taken over, so its points keep an owner; a stream that does not exist is 404.</summary>
    [Fact]
    public async Task ACanceledRound_IsTakenOver_AndAMissingStreamIsNotFound()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);
        using var canceled = await world.SendAsync(A.Admin, HttpMethod.Post, RoundCalls.RoundPath(world, round) + "/cancel");
        Assert.Equal(HttpStatusCode.OK, canceled.StatusCode);

        var taken = await CourtCalls.TakenOverAsync(world, A.Admin, round, phone.TakingOver(batch: 2), 1, 1);
        using var missing = await CourtCalls.TakeOverAsync(world, A.Admin, round, CourtPhone.New(), 1, 1);

        Assert.Equal(2, taken.Batch);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Equal("matches.court-session-not-found", await RoundCalls.CodeAsync(missing));
    }

    /// <summary>
    /// R98: the phone that writes batch 1, back with the same login, gets its batch again with <c>eventsBefore</c> 0 and
    /// its last sequence; <c>eventCount</c> is the whole stream, the snapshot that matches that sequence.
    /// </summary>
    [Fact]
    public async Task ThePairAlreadyWriting_GetsItsBatchAgain_WithTheEventCountOfTheWholeStream()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        string[] sent = [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]), .. phone.AlternatingPoints(PointsOfA)];
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, sent);

        var taken = await CourtCalls.TakenOverAsync(world, A.Scorekeeper, round, phone, 1, EventsOfA);

        Assert.Equal((1L, 0L, (long)EventsOfA, (long)EventsOfA), taken);
    }

    /// <summary>A9 and L1: the export of who took over has the new batch; no log carries a device id, a member id nor a body.</summary>
    [Fact]
    public async Task TheExportHasTheTakeover_AndTheLogsOnlyIds()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);
        var other = phone.TakingOver(batch: 2);
        _ = await CourtCalls.TakenOverAsync(world, A.CoAdmin, round, other, 1, 1);
        using var refused = await CourtCalls.SendAsync(world, A.Scorekeeper, round, phone, [phone.Point("a")]);
        using var stale = await CourtCalls.TakeOverAsync(world, A.Scorekeeper, round, phone, 1, 1);

        using var export = await world.SendAsync(A.CoAdmin, HttpMethod.Get, "/v1/me/export");
        var writes = (await RoundCalls.JsonAsync(export))["courtWrites"]!.AsArray();

        var entry = Assert.Single(writes);
        Assert.Equal(2, entry!["batch"]!.GetValue<long>());
        Assert.Equal(other.DeviceId, entry["deviceId"]!.GetValue<Guid>());
        Assert.Equal("matches.stream-changed", await RoundCalls.CodeAsync(stale));
        Assert.Contains(api.Logs.Entries, entry => entry.Contains("Court taken over.", StringComparison.Ordinal));
        string[] forbidden = [phone.DeviceId.ToString(), other.DeviceId.ToString(), .. world.MemberIds.Values.Select(id => id.ToString())];
        Assert.DoesNotContain(api.Logs.Entries, line => forbidden.Any(value => line.Contains(value, StringComparison.OrdinalIgnoreCase)));
    }

    /// <summary>D10: the 40th batch is accepted, the 41st is 422 <c>limit-reached</c> <c>writers-per-stream</c>.</summary>
    [Fact]
    public async Task TheFortyFirstBatch_IsRefused()
    {
        const long MaxBatches = 40;
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);

        for (var batch = 1L; batch < MaxBatches; batch++)
        {
            Assert.Equal(batch + 1, (await CourtCalls.TakenOverAsync(world, A.CoAdmin, round, phone.TakingOver(batch + 1), batch, 1)).Batch);
        }

        using var refused = await CourtCalls.TakeOverAsync(world, A.Admin, round, phone.TakingOver(MaxBatches + 1), MaxBatches, 1);
        var body = await RoundCalls.JsonAsync(refused);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, refused.StatusCode);
        Assert.Equal("matches.limit-reached", body["code"]!.GetValue<string>());
        Assert.Equal("writers-per-stream", body["limit"]!.GetValue<string>());
        Assert.Equal(MaxBatches, await WritersAsync(phone.CourtSessionId));
    }

    public static readonly TheoryData<string, string> InvalidBodies = new()
    {
        { """{"deviceId":null,"expectedBatch":1,"expectedEventCount":1}""", "deviceId" },
        { """{"deviceId":"E0000000-0000-4000-8000-000000000001","expectedBatch":1,"expectedEventCount":1}""", "deviceId" },
        { """{"deviceId":"e0000000-0000-4000-8000-000000000001","expectedBatch":99999999999999999999,"expectedEventCount":1}""", "expectedBatch" },
        { """{"deviceId":"e0000000-0000-4000-8000-000000000001","expectedBatch":1.5,"expectedEventCount":1}""", "expectedBatch" },
        { """{"deviceId":"e0000000-0000-4000-8000-000000000001","expectedBatch":-1,"expectedEventCount":1}""", "expectedBatch" },
        { """{"deviceId":"e0000000-0000-4000-8000-000000000001","expectedBatch":1,"expectedEventCount":"7"}""", "expectedEventCount" },
        { """{"deviceId":"e0000000-0000-4000-8000-000000000001","expectedBatch":1}""", "expectedEventCount" },
        { """{"deviceId":"e0000000-0000-4000-8000-000000000001","expectedBatch":1,"expectedEventCount":1,"memberIdSecret":1}""", "body" },
        { """{"deviceId":"e0000000-0000-4000-8000-000000000001","deviceId":"e0000000-0000-4000-8000-000000000002","expectedBatch":1,"expectedEventCount":1}""", "body" },
        { "null", "body" },
        { "[]", "body" },
        { "{", "body" },
    };

    /// <summary>A null, a wrong type or a number past <c>long</c> is a 400 with the field and never an echo, nor a 500.</summary>
    [Theory]
    [MemberData(nameof(InvalidBodies))]
    public async Task AnInvalidBody_IsTakeoverInvalid(string body, string field)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);

        using var refused = await world.SendAsync(A.Admin, HttpMethod.Post, CourtCalls.TakeoverPath(world, round, Guid.NewGuid()), body);
        var text = await refused.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        var problem = JsonNode.Parse(text)!.AsObject();

        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
        Assert.Equal(TakeoverInvalid, problem["code"]!.GetValue<string>());
        Assert.Equal(field, problem["field"]!.GetValue<string>());
        Assert.DoesNotContain("99999999999999999999", text, StringComparison.Ordinal);
        Assert.DoesNotContain("memberIdSecret", text, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ABodyPastOneKibibyte_Is413()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var padded = $$"""{"deviceId":"{{new string('a', 2048)}}","expectedBatch":1,"expectedEventCount":1}""";

        using var refused = await world.SendAsync(A.Admin, HttpMethod.Post, CourtCalls.TakeoverPath(world, round, Guid.NewGuid()), padded);

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, refused.StatusCode);
    }

    private Task<long> WritersAsync(Guid courtSessionId) =>
        CourtCalls.CountAsync(api.ConnectionString, "SELECT count(*) FROM matches.court_writers WHERE court_session_id = @id", courtSessionId);
}
