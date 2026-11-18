using System.Net;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Sessions;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Matches;

/// <summary>
/// A1, A2, A4, A5, A6, A8, A9 and L1 of E3.7 on the real API and a real Postgres: a resend never duplicates, the first
/// write creates the stream and its writer, the stream belongs to one round, only the writer writes, the members are
/// the group's, all or nothing, a corrupt row fails closed, and nothing received reaches a log.
/// </summary>
public sealed class CourtStreamTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int ConcurrentResends = 16;

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>A1, the acceptance: "Reenvio não duplica", in full, in part and in 16 requests at once.</summary>
    [Fact]
    public async Task Resend_NeverDuplicates_InFullInPartOrConcurrently()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        string[] all = [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]), .. phone.AlternatingPoints(4)];

        Assert.Equal((3L, 3), await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, all[..3]));
        Assert.Equal((3L, 0), await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, all[..3]));
        Assert.Equal((5L, 2), await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, all[1..]));
        var concurrent = await Task.WhenAll(Enumerable.Range(0, ConcurrentResends)
            .Select(_ => CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, all)));

        Assert.All(concurrent, written => Assert.Equal((5L, 0), written));
        Assert.Equal(all, await CourtCalls.StoredEnvelopesAsync(api.ConnectionString, phone.CourtSessionId));
    }

    /// <summary>A1: the same event id with other content is a conflict, and nothing changes.</summary>
    [Fact]
    public async Task SameEventId_WithOtherContent_IsAConflict_AndNothingChanges()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        var first = phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]);
        var point = phone.Point("a");
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [first, point]);

        using var conflict = await CourtCalls.SendAsync(world, A.Scorekeeper, round, phone, [first, point.Replace("\"team\":\"a\"", "\"team\":\"b\"", StringComparison.Ordinal)]);

        Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode);
        Assert.Equal("matches.event-id-conflict", await RoundCalls.CodeAsync(conflict));
        Assert.Equal([first, point], await CourtCalls.StoredEnvelopesAsync(api.ConnectionString, phone.CourtSessionId));
    }

    /// <summary>A2: the first write creates the stream with batch 1, written by that device and the caller's member id.</summary>
    [Fact]
    public async Task FirstWrite_CreatesTheStream_AndItsWriter()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();

        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);

        Assert.Equal(1, await CourtCalls.CountAsync(api.ConnectionString,
            "SELECT count(*) FROM matches.court_sessions WHERE id = @id AND current_batch = 1 AND event_count = 1 AND envelope_bytes > 0 AND last_event_at IS NOT NULL", phone.CourtSessionId));
        Assert.Equal(1, await CourtCalls.CountAsync(api.ConnectionString,
            $"SELECT count(*) FROM matches.court_writers WHERE court_session_id = @id AND batch = 1 AND events_before = 0 AND device_id = '{phone.DeviceId}' AND member_id = '{world.MemberIds[A.Scorekeeper]}'",
            phone.CourtSessionId));
        Assert.Equal(1, await CourtCalls.CountAsync(api.ConnectionString,
            $"SELECT count(*) FROM matches.court_events WHERE court_session_id = @id AND match_id = '{phone.MatchId}' AND type = 'MatchStarted'", phone.CourtSessionId));
    }

    /// <summary>A4: the round of another group is the Sessions' 404.</summary>
    [Fact]
    public async Task RoundOfAnotherGroup_IsNotFound()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var other = await GroupWorld.CreateAsync(api, client, "Outro racha");
        var foreignRound = await CourtCalls.RoundAsync(other);
        var phone = CourtPhone.New();

        using var response = await CourtCalls.SendAsync(world, A.Admin, foreignRound, phone, [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(CourtCalls.RoundNotFound, await RoundCalls.CodeAsync(response));
        Assert.Equal(0, await CourtCalls.CountAsync(api.ConnectionString, "SELECT count(*) FROM matches.court_sessions WHERE id = @id", phone.CourtSessionId));
    }

    /// <summary>A4: a stream used with another round or another group gets one and the same 404, which says nothing of where it is.</summary>
    [Fact]
    public async Task StreamOfAnotherRoundOrGroup_IsTheSameNotFound()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var other = await GroupWorld.CreateAsync(api, client, "Outro racha");
        var round = await CourtCalls.RoundAsync(world);
        var secondRound = await CourtCalls.RoundAsync(world);
        var otherRound = await CourtCalls.RoundAsync(other);
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Admin, round, phone, [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);

        var next = phone.Point("a");
        using var otherRoundOfTheGroup = await CourtCalls.SendAsync(world, A.Admin, secondRound, phone, [next]);
        using var otherGroup = await CourtCalls.SendAsync(other, A.Admin, otherRound, phone, [next]);

        Assert.Equal(HttpStatusCode.NotFound, otherRoundOfTheGroup.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, otherGroup.StatusCode);
        Assert.Equal("matches.court-session-not-found", await RoundCalls.CodeAsync(otherGroup));
        Assert.Equal(await CourtCalls.ProblemWithoutTraceAsync(otherRoundOfTheGroup), await CourtCalls.ProblemWithoutTraceAsync(otherGroup));
        Assert.Equal(1, await CourtCalls.EventCountAsync(api.ConnectionString, phone.CourtSessionId));
    }

    /// <summary>A4 and D7: one court per round; a canceled round gets no new stream, but an existing one goes on.</summary>
    [Fact]
    public async Task OneCourtPerRound_AndACanceledRoundOnlyContinues()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var canceledFresh = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        var second = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Admin, round, phone, [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);

        using var secondStream = await CourtCalls.SendAsync(world, A.CoAdmin, round, second, [second.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);
        await CancelAsync(world, round);
        await CancelAsync(world, canceledFresh);
        var fresh = CourtPhone.New();
        using var created = await CourtCalls.SendAsync(world, A.Admin, canceledFresh, fresh, [fresh.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);

        Assert.Equal(HttpStatusCode.Conflict, secondStream.StatusCode);
        Assert.Equal("matches.round-has-court-session", await RoundCalls.CodeAsync(secondStream));
        Assert.Equal(HttpStatusCode.Conflict, created.StatusCode);
        Assert.Equal("matches.round-canceled", await RoundCalls.CodeAsync(created));
        Assert.Equal((2L, 1), await CourtCalls.AcceptedAsync(world, A.Admin, round, phone, [phone.Point("a")]));
    }

    /// <summary>A5: a second phone of the same scorekeeper, and another scorekeeper on the same phone, are not the writer.</summary>
    [Fact]
    public async Task OnlyTheWriter_Writes()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);
        var (otherScorekeeper, _) = await world.AddPersonAsync("scorekeeper");
        var secondPhone = phone.OtherDevice();
        var point = phone.Point("a");

        using var fromSecondPhone = await CourtCalls.SendAsync(world, A.Scorekeeper, round, secondPhone, [secondPhone.Point("a")]);
        using var fromOtherPerson = await world.SendAsAsync(otherScorekeeper, HttpMethod.Post, CourtCalls.EventsPath(world, round, phone.CourtSessionId), CourtPhone.Body([point]));

        Assert.Equal(HttpStatusCode.Conflict, fromSecondPhone.StatusCode);
        Assert.Equal("matches.not-the-writer", await RoundCalls.CodeAsync(fromSecondPhone));
        Assert.Equal(HttpStatusCode.Conflict, fromOtherPerson.StatusCode);
        Assert.Equal("matches.not-the-writer", await RoundCalls.CodeAsync(fromOtherPerson));
        Assert.Equal(1, await CourtCalls.EventCountAsync(api.ConnectionString, phone.CourtSessionId));
    }

    /// <summary>A6: a member of another group is refused without its id; a member who left and a guest are the group's.</summary>
    [Fact]
    public async Task MembersOutsideTheGroup_AreRefused_WithoutTheirId()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var outsider = world.MemberIds[A.OutsiderMember];
        var phone = CourtPhone.New();

        using var refused = await CourtCalls.SendAsync(world, A.Admin, round, phone, [phone.MatchStarted(world.MemberIds[A.Admin], outsider)]);

        var body = await refused.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Assert.Equal((HttpStatusCode)StatusCodes.UnprocessableContent, refused.StatusCode);
        Assert.Equal("matches.member-not-in-group", await RoundCalls.CodeAsync(refused));
        Assert.DoesNotContain(outsider.ToString(), body, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(0, await CourtCalls.CountAsync(api.ConnectionString, "SELECT count(*) FROM matches.court_sessions WHERE id = @id", phone.CourtSessionId));

        var guest = await GuestCalls.CreateAsync(world);
        var accepted = CourtPhone.New();
        Assert.Equal((1L, 1), await CourtCalls.AcceptedAsync(world, A.Admin, round, accepted, [accepted.MatchStarted(world.MemberIds[A.LeftMember], guest)]));
    }

    /// <summary>A8: a batch of 3 whose third is implausible stores nothing, and names the third.</summary>
    [Fact]
    public async Task ARefusedEvent_StoresNoneOfTheBatch()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        var start = phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]);
        var point = phone.Point("a");
        var eventId = Guid.NewGuid();
        var wrongSetEnd = phone.Envelope(eventId, "SetEnded",
            $$"""{"matchId":"{{phone.MatchId}}","nextSet":{"firstServer":"b","setterZones":{"a":null,"b":null},"targetPoints":25},"setNumber":1,"winner":"b"}""");

        using var refused = await CourtCalls.SendAsync(world, A.Admin, round, phone, [start, point, wrongSetEnd]);

        Assert.Equal((HttpStatusCode)StatusCodes.UnprocessableContent, refused.StatusCode);
        Assert.Equal("matches.event-implausible", await RoundCalls.CodeAsync(refused));
        Assert.Contains(eventId.ToString(), await refused.Content.ReadAsStringAsync(TestContext.Current.CancellationToken), StringComparison.Ordinal);
        Assert.Equal(0, await CourtCalls.EventCountAsync(api.ConnectionString, phone.CourtSessionId));
    }

    /// <summary>A9: a row changed by hand fails closed, with nothing of it in the answer or the log.</summary>
    [Fact]
    public async Task ACorruptRow_IsAGeneric500()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Admin, round, phone, [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);
        const string Marker = "corrupt-marker-7f3a";
        await CourtCalls.ExecuteAsync(api.ConnectionString,
            "UPDATE matches.court_events SET envelope = @text WHERE court_session_id = @id", ("text", $$"""{"{{Marker}}":true}"""), ("id", phone.CourtSessionId));
        var logsBefore = api.Logs.Count;

        using var response = await CourtCalls.SendAsync(world, A.Admin, round, phone, [phone.Point("a")]);

        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.DoesNotContain(Marker, body, StringComparison.Ordinal);
        Assert.DoesNotContain(api.Logs.EntriesSince(logsBefore), entry => entry.Contains(Marker, StringComparison.Ordinal));
        Assert.Contains(api.Logs.EntriesSince(logsBefore), entry => entry.Contains(phone.CourtSessionId.ToString(), StringComparison.Ordinal));
    }

    /// <summary>L1: the member ids, an unknown key and the content of the body never reach a log, accepted or refused.</summary>
    [Fact]
    public async Task NothingReceived_ReachesALog()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        const string UnknownKey = "unknownKeyMarker42";
        var logsBefore = api.Logs.Count;

        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);
        using var unknown = await CourtCalls.SendAsync(world, A.Scorekeeper, round, phone,
            [phone.Envelope("PointScored", $$"""{"matchId":"{{phone.MatchId}}","setNumber":1,"team":"a","{{UnknownKey}}":1}""")]);
        using var notAnEnvelope = await world.SendAsync(A.Scorekeeper, HttpMethod.Post, CourtCalls.EventsPath(world, round, phone.CourtSessionId), """{"events":["not-an-envelope"]}""");
        phone.ResumeAt(2);
        using var outsider = await CourtCalls.SendAsync(world, A.Scorekeeper, round, phone, [phone.Point("a"), phone.Envelope("QueueChanged",
            $$$"""{"matchId":"{{{phone.MatchId}}}","queue":{"players":["{{{world.MemberIds[A.OutsiderMember]}}}"],"teams":[]}}""")]);

        // An unknown key inside the payload is the payload parser's, in the replay: 422, not the 400 of the envelope.
        Assert.Equal((HttpStatusCode)StatusCodes.UnprocessableContent, unknown.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, notAnEnvelope.StatusCode);
        Assert.Equal((HttpStatusCode)StatusCodes.UnprocessableContent, outsider.StatusCode);
        string[] forbidden =
        [
            UnknownKey, "not-an-envelope", phone.DeviceId.ToString(), phone.MatchId.ToString(),
            .. new[] { A.Admin, A.Player, A.Scorekeeper, A.OutsiderMember }.Select(actor => world.MemberIds[actor].ToString()),
        ];
        var entries = api.Logs.EntriesSince(logsBefore);
        Assert.Contains(entries, entry => entry.Contains("Court events stored.", StringComparison.Ordinal));
        Assert.DoesNotContain(entries, entry => forbidden.Any(value => entry.Contains(value, StringComparison.OrdinalIgnoreCase)));
    }

    private static async Task CancelAsync(GroupWorld world, string round)
    {
        using var canceled = await world.SendAsync(A.Admin, HttpMethod.Post, RoundCalls.RoundPath(world, round) + "/cancel");
        Assert.Equal(HttpStatusCode.OK, canceled.StatusCode);
    }
}

internal static class StatusCodes
{
    public const int UnprocessableContent = 422;
}
