using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using Sacou.Integration.Tests.Groups;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Sessions;

/// <summary>Cases 1 to 15 and 17 to 20 of the E3.12 plan, part 1: the link code, the way in as an avulso and the "vou" by the link.</summary>
public sealed class RoundLinkTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int CodeLength = 22;
    private const string TraceIdField = "traceId";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>Cases 1 and 20: every round has its own code, and only Admin and Co-admin see the link.</summary>
    [Fact]
    public async Task Round_HasItsOwnCode_AndOnlyWhoManagesRoundsSeesTheLink()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        var (first, firstCode) = await RoundLinkCalls.RoundAsync(world);
        var (_, secondCode) = await RoundLinkCalls.RoundAsync(world, RoundCalls.CreateBody(RoundCalls.FutureDate(4)));

        Assert.Equal(CodeLength, firstCode.Length);
        Assert.NotEqual(firstCode, secondCode);
        Assert.Equal(firstCode, RoundLinkCalls.CodeOf(await RoundCalls.GetAsync(world, first, A.CoAdmin)));
        Assert.Null((await RoundCalls.GetAsync(world, first, A.Player))["shareUrl"]);
        Assert.Null((await RoundCalls.GetAsync(world, first, A.Scorekeeper))["shareUrl"]);
    }

    /// <summary>Case 6: a round made before the link has no code until someone who may share it reads it, and keeps that one.</summary>
    [Fact]
    public async Task OlderRound_GetsItsCode_OnTheFirstReadByAnAdmin()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world);
        var (round, _) = await RoundLinkCalls.RoundAsync(world);
        await RoundLinkCalls.ExecuteAsync(api.ConnectionString, "UPDATE sessions.rounds SET link_code = NULL WHERE id = @round", round);

        Assert.Null((await RoundCalls.GetAsync(world, round, A.Player))["shareUrl"]);
        var code = RoundLinkCalls.CodeOf(await RoundCalls.GetAsync(world, round));

        Assert.Equal(code, RoundLinkCalls.CodeOf(await RoundCalls.GetAsync(world, round, A.CoAdmin)));
        var (status, _) = await RoundLinkCalls.AnswerAsync(world, A.NonMember, code);
        Assert.Equal(HttpStatusCode.OK, status);
    }

    /// <summary>Cases 2 and 3: a malformed code and a code of no round get the very same answer.</summary>
    [Theory]
    [InlineData("K7fQ2xAbCdEfGhIjKlMn-")]
    [InlineData("K7fQ2xAbCdEfGhIjKlMn-_a")]
    [InlineData("K7fQ2xAbCdEfGhIjKlMn+_")]
    [InlineData("K7fQ2xAbCdEfGhIjKlMn _")]
    [InlineData("K7fQ2xAbCdEfGhIjKlMné_")]
    [InlineData(null)]
    public async Task MalformedCode_IsTheSame404_AsACodeOfNoRound(string? malformed)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        var bodies = new List<string>();
        foreach (var code in new[] { malformed, "AAAAAAAAAAAAAAAAAAAAAA" })
        {
            foreach (var (path, body) in new[] { (RoundLinkCalls.ResolvePath, RoundLinkCalls.ResolveBody(code)), (RoundLinkCalls.AttendancePath, RoundLinkCalls.AnswerBody(code)) })
            {
                using var response = await world.SendAsync(A.NonMember, HttpMethod.Post, path, body);
                Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
                Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
                bodies.Add(await WithoutTraceIdAsync(response));
            }
        }

        Assert.Single(bodies.Distinct(StringComparer.Ordinal));
        Assert.Contains(RoundLinkCalls.LinkInvalid, bodies[0], StringComparison.Ordinal);
    }

    /// <summary>The body and its type, without the trace id every answer has its own of.</summary>
    private static async Task<string> WithoutTraceIdAsync(HttpResponseMessage response)
    {
        var body = JsonNode.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!.AsObject();
        Assert.True(body.Remove(TraceIdField));
        return $"{response.Content.Headers.ContentType}|{body.ToJsonString()}";
    }

    /// <summary>Case 4: a cancelled round lets nobody in.</summary>
    [Fact]
    public async Task CanceledRound_IsClosed_AndPutsNobodyInTheGroup()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var (round, code) = await RoundLinkCalls.RoundAsync(world);
        using var cancel = await world.SendAsync(A.Admin, HttpMethod.Post, RoundCalls.RoundPath(world, round) + "/cancel");

        var (status, body) = await RoundLinkCalls.AnswerAsync(world, A.NonMember, code);

        Assert.Equal(HttpStatusCode.Conflict, status);
        Assert.Equal(RoundLinkCalls.RoundClosed, RoundLinkCalls.Code(body));
        Assert.Null(body["joined"]);
        Assert.Null(await RoundLinkCalls.MemberOfAsync(api.ConnectionString, world.GroupId, world.Users[A.NonMember]));
        using var resolved = await world.SendAsync(A.NonMember, HttpMethod.Post, RoundLinkCalls.ResolvePath, RoundLinkCalls.ResolveBody(code));
        AssertClosedResolution(await RoundCalls.JsonAsync(resolved));
    }

    /// <summary>Case 5: at the very instant of the start the link is closed, and nobody comes in.</summary>
    [Fact]
    public async Task StartedRound_IsClosed_FromItsVeryInstant()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var created = await RoundCalls.CreateAsync(world);
        var code = RoundLinkCalls.CodeOf(created);
        api.Clock.SetNow(created["startsAt"]!.GetValue<DateTimeOffset>());

        var (status, body) = await RoundLinkCalls.AnswerAsync(world, A.NonMember, code);
        using var resolved = await world.SendAsync(A.NonMember, HttpMethod.Post, RoundLinkCalls.ResolvePath, RoundLinkCalls.ResolveBody(code));

        Assert.Equal(HttpStatusCode.Conflict, status);
        Assert.Equal(RoundLinkCalls.RoundClosed, RoundLinkCalls.Code(body));
        Assert.Null(await RoundLinkCalls.MemberOfAsync(api.ConnectionString, world.GroupId, world.Users[A.NonMember]));
        Assert.Equal(HttpStatusCode.OK, resolved.StatusCode);
        AssertClosedResolution(await RoundCalls.JsonAsync(resolved));
    }

    /// <summary>Case 7: a stranger comes in as a player and an avulso, and goes, by the web.</summary>
    [Fact]
    public async Task NonMember_ComesInAsDropIn_AndGoes_ByTheWeb()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world);
        var (round, code) = await RoundLinkCalls.RoundAsync(world);

        var (status, body) = await RoundLinkCalls.AnswerAsync(world, A.NonMember, code);

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.True(body["joined"]!.GetValue<bool>());
        Assert.Equal("going", body["status"]!.GetValue<string>());
        Assert.Equal((world.GroupId, Guid.Parse(round)), (body["groupId"]!.GetValue<Guid>(), body["roundId"]!.GetValue<Guid>()));
        var member = (await RoundLinkCalls.MemberOfAsync(api.ConnectionString, world.GroupId, world.Users[A.NonMember]))!.Value;
        Assert.Equal((body["memberId"]!.GetValue<Guid>(), "player", "drop_in", "active"), member);
        Assert.Equal("web", (await RoundLinkCalls.AttendanceOfAsync(api.ConnectionString, round, member.Id))!.Value.Channel);
    }

    /// <summary>Case 8: before the avulsos' window the person still comes in, and the answer says both things.</summary>
    [Fact]
    public async Task DropInWindowClosed_StillJoins_AndSaysSo()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world, dropInOpensHoursBefore: 1);
        var (round, code) = await RoundLinkCalls.RoundAsync(world);

        var (status, body) = await RoundLinkCalls.AnswerAsync(world, A.NonMember, code);

        Assert.Equal(HttpStatusCode.Conflict, status);
        Assert.Equal("sessions.drop-in-window-closed", RoundLinkCalls.Code(body));
        Assert.True(body["joined"]!.GetValue<bool>());
        var member = (await RoundLinkCalls.MemberOfAsync(api.ConnectionString, world.GroupId, world.Users[A.NonMember]))!.Value;
        Assert.Equal("active", member.Status);
        Assert.Null(await RoundLinkCalls.AttendanceOfAsync(api.ConnectionString, round, member.Id));
    }

    /// <summary>Cases 9 and 10: a full round puts the newcomer in line, or, without a line, says it is full after the way in.</summary>
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task FullRound_Waitlists_OrIsFull_AfterTheWayIn(bool waitlist)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world, capacity: 2, waitlist: waitlist);
        var (round, code) = await RoundLinkCalls.RoundAsync(world);
        _ = await RoundCalls.RespondAsync(world, world.Subjects[A.Player], round, going: true);
        _ = await RoundCalls.RespondAsync(world, world.Subjects[A.Scorekeeper], round, going: true);

        var (status, body) = await RoundLinkCalls.AnswerAsync(world, A.NonMember, code);

        Assert.True(body["joined"]!.GetValue<bool>());
        if (waitlist)
        {
            Assert.Equal(HttpStatusCode.OK, status);
            Assert.Equal(("waitlisted", 1), (body["status"]!.GetValue<string>(), body["position"]!.GetValue<int>()));
        }
        else
        {
            Assert.Equal(HttpStatusCode.Conflict, status);
            Assert.Equal("sessions.round-full", RoundLinkCalls.Code(body));
        }
    }

    /// <summary>Case 11: whoever was removed stays out, and nothing is written.</summary>
    [Fact]
    public async Task RemovedMember_IsRefused_AndNothingIsWritten()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var (round, code) = await RoundLinkCalls.RoundAsync(world);

        var (status, body) = await RoundLinkCalls.AnswerAsync(world, A.RemovedMember, code);

        Assert.Equal(HttpStatusCode.Forbidden, status);
        Assert.Equal("groups.member-removed", RoundLinkCalls.Code(body));
        Assert.Equal("removed", (await MemberRows.ReadAsync(api.ConnectionString, world.MemberIds[A.RemovedMember])).Status);
        Assert.Null(await RoundLinkCalls.AttendanceOfAsync(api.ConnectionString, round, world.MemberIds[A.RemovedMember]));
    }

    /// <summary>Case 12: whoever left comes back with the same member id, as a player and an avulso.</summary>
    [Fact]
    public async Task LeftMember_ComesBack_WithTheSameMemberId()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world);
        var (_, code) = await RoundLinkCalls.RoundAsync(world);

        var (status, body) = await RoundLinkCalls.AnswerAsync(world, A.LeftMember, code);

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(world.MemberIds[A.LeftMember], body["memberId"]!.GetValue<Guid>());
        Assert.Equal(new MemberState("player", "drop_in", "active", false), await MemberRows.ReadAsync(api.ConnectionString, world.MemberIds[A.LeftMember]));
    }

    /// <summary>Case 14: a mensalista answers as one (no avulsos' window) and keeps role and type; joined is false.</summary>
    [Fact]
    public async Task Regular_AnswersAsARegular_AndKeepsRoleAndType()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world, dropInOpensHoursBefore: 1);
        var regular = await world.AddPersonAsync(role: "co_admin", memberType: "regular");
        var (_, code) = await RoundLinkCalls.RoundAsync(world);

        var (status, body) = await RoundLinkCalls.AnswerAsync(world, regular.Subject, code);

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.False(body["joined"]!.GetValue<bool>());
        Assert.Equal(new MemberState("co_admin", "regular", "active", false), await MemberRows.ReadAsync(api.ConnectionString, regular.MemberId));
    }

    /// <summary>Case 15: "vou" twice keeps the sequence and the channel; "não vou" then frees the spot for the line.</summary>
    [Fact]
    public async Task RepeatedGoing_ChangesNothing_AndGivingUpPromotesTheLine()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world, capacity: 2);
        var (round, code) = await RoundLinkCalls.RoundAsync(world);
        _ = await RoundCalls.RespondAsync(world, world.Subjects[A.Player], round, going: true);
        _ = await RoundCalls.RespondAsync(world, world.Subjects[A.Scorekeeper], round, going: true);
        _ = await RoundLinkCalls.AnswerAsync(world, A.Player, code);
        var before = await RoundLinkCalls.AttendanceOfAsync(api.ConnectionString, round, world.MemberIds[A.Player]);
        _ = await RoundLinkCalls.AnswerAsync(world, A.NonMember, code);

        var (status, body) = await RoundLinkCalls.AnswerAsync(world, A.Player, code, going: false);

        Assert.Equal(("going", "app"), (before!.Value.Status, before.Value.Channel));
        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal("notGoing", body["status"]!.GetValue<string>());
        Assert.Equal("web", (await RoundLinkCalls.AttendanceOfAsync(api.ConnectionString, round, world.MemberIds[A.Player]))!.Value.Channel);
        var promoted = (await RoundLinkCalls.MemberOfAsync(api.ConnectionString, world.GroupId, world.Users[A.NonMember]))!.Value.Id;
        Assert.Equal("promoted", (await RoundLinkCalls.AttendanceOfAsync(api.ConnectionString, round, promoted))!.Value.Status);
    }

    /// <summary>Case 17: without <c>POST /v1/me</c> the link is a 403 and nothing is written; without a token, a 401.</summary>
    [Fact]
    public async Task Unregistered_Is403_AndAnonymous_Is401()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var (_, code) = await RoundLinkCalls.RoundAsync(world);

        var (status, body) = await RoundLinkCalls.AnswerAsync(world, A.Unregistered, code);
        using var anonymous = await world.SendAsync(A.Anonymous, HttpMethod.Post, RoundLinkCalls.AttendancePath, RoundLinkCalls.AnswerBody(code));

        Assert.Equal(HttpStatusCode.Forbidden, status);
        Assert.Equal(RoundCalls.NotRegistered, RoundLinkCalls.Code(body));
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
    }

    /// <summary>Case 18: ids or any other field in the body are a 400; a body that is not JSON is a 415.</summary>
    [Theory]
    [InlineData("""{"code":"AAAAAAAAAAAAAAAAAAAAAA","response":"going","memberId":"00000000-0000-0000-0000-000000000001"}""")]
    [InlineData("""{"code":"AAAAAAAAAAAAAAAAAAAAAA","response":"going","groupId":"00000000-0000-0000-0000-000000000001"}""")]
    [InlineData("""{"code":"AAAAAAAAAAAAAAAAAAAAAA"}""")]
    [InlineData("""{"code":"AAAAAAAAAAAAAAAAAAAAAA","response":1}""")]
    public async Task ExtraOrMissingField_Is400(string body)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await world.SendAsync(A.NonMember, HttpMethod.Post, RoundLinkCalls.AttendancePath, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task NotJson_Is415()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        using var request = new HttpRequestMessage(HttpMethod.Post, RoundLinkCalls.AttendancePath)
        {
            Content = new StringContent(RoundLinkCalls.AnswerBody("AAAAAAAAAAAAAAAAAAAAAA"), Encoding.UTF8, "text/plain"),
        };
        request.Headers.Authorization = new("Bearer", world.TokenFor(A.NonMember));

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.UnsupportedMediaType, response.StatusCode);
    }

    /// <summary>Case 19: the resolution says only the ids and whether the caller is in, never a name.</summary>
    [Fact]
    public async Task Resolve_SaysOnlyTheIds_AndWhetherTheCallerIsIn()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client, groupName: "ZZGROUPMARK");
        var (round, code) = await RoundLinkCalls.RoundAsync(world);

        using var stranger = await world.SendAsync(A.NonMember, HttpMethod.Post, RoundLinkCalls.ResolvePath, RoundLinkCalls.ResolveBody(code));
        using var member = await world.SendAsync(A.Player, HttpMethod.Post, RoundLinkCalls.ResolvePath, RoundLinkCalls.ResolveBody(code));

        var strangerBody = await RoundCalls.JsonAsync(stranger);
        Assert.Equal(["isOpen", "groupId", "roundId", "isMember"], strangerBody.Select(property => property.Key));
        Assert.True(strangerBody["isOpen"]!.GetValue<bool>());
        Assert.Equal((world.GroupId, Guid.Parse(round), false), (strangerBody["groupId"]!.GetValue<Guid>(), strangerBody["roundId"]!.GetValue<Guid>(), strangerBody["isMember"]!.GetValue<bool>()));
        Assert.True((await RoundCalls.JsonAsync(member))["isMember"]!.GetValue<bool>());
        Assert.Null(await RoundLinkCalls.MemberOfAsync(api.ConnectionString, world.GroupId, world.Users[A.NonMember]));
        Assert.DoesNotContain(api.Logs.Entries, entry => entry.Contains(code, StringComparison.Ordinal) || entry.Contains("ZZGROUPMARK", StringComparison.Ordinal));
    }

    /// <summary>A closed round says only that: no way to the group or the round from a link that outlived it.</summary>
    private static void AssertClosedResolution(JsonObject body)
    {
        Assert.False(body["isOpen"]!.GetValue<bool>());
        Assert.Null(body["groupId"]);
        Assert.Null(body["roundId"]);
    }
}
