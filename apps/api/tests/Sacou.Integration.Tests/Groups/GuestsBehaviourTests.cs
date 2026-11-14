using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Sacou.Integration.Tests.Sessions;
using Sacou.Modules.Groups.Contracts;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Groups;

/// <summary>
/// E3.5 on the real API and a real Postgres (ADR 0053): the acceptance ("Convidado joga e aparece nas estatísticas da
/// rodada": a member id, a Going row, the round and the member list, the draw's inputs), the resend, the refused
/// bodies, the correction, the removal and what never reaches a log, a response or the database after a removal.
/// </summary>
public sealed class GuestsBehaviourTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string Leo = "Léo Canário";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>H1: five spots, four going; the admin adds the guest and marks it going. It is the fifth, everywhere.</summary>
    [Fact]
    public async Task Acceptance_GuestGoes_AndIsInTheRoundTheListAndTheDraw()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world, capacity: 5, waitlist: false);
        var round = (await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>();
        foreach (var actor in new[] { A.Admin, A.CoAdmin, A.Scorekeeper, A.Player })
        {
            Assert.Equal(HttpStatusCode.OK, await RoundCalls.SetAsync(world, round, world.MemberIds[actor], going: true));
        }

        var guest = await GuestCalls.CreateAsync(world, Leo, position: "libero");
        var rated = await GuestCalls.CreateAsync(world, "Bia", level: "4.5");
        Assert.Equal(HttpStatusCode.OK, await RoundCalls.SetAsync(world, round, guest, going: true));

        var detail = await RoundCalls.GetAsync(world, round);
        Assert.Contains(detail["going"]!.AsArray(), entry => entry!["memberId"]!.GetValue<Guid>() == guest);
        Assert.Single(await RoundCalls.RowsAsync(api.ConnectionString, round), row => row.MemberId == guest && row.Status == "going");
        var listed = (await GuestCalls.MembersAsync(world, A.Player))[guest];
        Assert.False(listed["hasAccount"]!.GetValue<bool>());
        Assert.Equal(Leo, listed["nickname"]!.GetValue<string>());
        Assert.Equal("libero", listed["primaryPosition"]!.GetValue<string>());
        Assert.Empty(listed["otherPositions"]!.AsArray());
        Assert.Equal("dropIn", listed["memberType"]!.GetValue<string>());
        Assert.Equal("player", listed["role"]!.GetValue<string>());

        using var scope = api.Services.CreateScope();
        var members = await scope.ServiceProvider.GetRequiredService<IGroupMembership>().ListActiveAsync(world.GroupId, TestContext.Current.CancellationToken);
        Assert.Contains(new GroupMembership(guest, GroupRole.Player, MemberType.DropIn), members);
        var levels = await scope.ServiceProvider.GetRequiredService<IMemberLevels>().ResolveAsync(world.GroupId, [guest, rated], TestContext.Current.CancellationToken);
        Assert.Contains(new ResolvedLevel(guest, 30, LevelSource.Default), levels);
        Assert.Contains(new ResolvedLevel(rated, 45, LevelSource.Admin), levels);
    }

    /// <summary>H2 and D4: a full round without a waitlist refuses the guest; the guest stays in the group.</summary>
    [Fact]
    public async Task FullRound_RefusesTheGuest_WhoStaysInTheGroup()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world, capacity: 1, waitlist: false);
        var round = (await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>();
        Assert.Equal(HttpStatusCode.OK, await RoundCalls.SetAsync(world, round, world.MemberIds[A.Player], going: true));
        var guest = await GuestCalls.CreateAsync(world);

        Assert.Equal(HttpStatusCode.Conflict, await RoundCalls.SetAsync(world, round, guest, going: true));
        Assert.Contains(guest, (await GuestCalls.MembersAsync(world)).Keys);
    }

    /// <summary>H2: the drop-in window is closed for the players, never for the admin marking a guest (E3.4).</summary>
    [Fact]
    public async Task ClosedDropInWindow_DoesNotStopTheAdminMarkingTheGuest()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world, capacity: 12, dropInOpensHoursBefore: 1);
        var round = (await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>();
        var guest = await GuestCalls.CreateAsync(world);

        Assert.Equal(HttpStatusCode.OK, await RoundCalls.SetAsync(world, round, guest, going: true));
    }

    /// <summary>H3: a new round with mensalistas confirms them, never the guest.</summary>
    [Fact]
    public async Task NewRoundWithRegulars_NeverConfirmsTheGuest()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world, regulars: true);
        var regular = await world.AddPersonAsync(memberType: "regular");
        var guest = await GuestCalls.CreateAsync(world);

        var round = (await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>();

        var rows = await RoundCalls.RowsAsync(api.ConnectionString, round);
        Assert.Contains(rows, row => row.MemberId == regular.MemberId);
        Assert.DoesNotContain(rows, row => row.MemberId == guest);
    }

    /// <summary>H4 and D5: the same request id twice is 201 then 200, one guest, the first name; another group makes its own.</summary>
    [Fact]
    public async Task SameRequestId_IsOneGuest_InItsGroupOnly()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var requestId = Guid.NewGuid();

        using var first = await GuestCalls.AddAsync(world, Leo, requestId);
        using var again = await GuestCalls.AddAsync(world, "Outro nome", requestId);
        using var elsewhere = await world.SendAsync(
            A.OutsiderMember, HttpMethod.Post, $"{GroupWorld.GroupsPath}/{world.OtherGroupId}/guests", GuestCalls.AddBody(requestId, Leo));

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        Assert.Equal(HttpStatusCode.Created, elsewhere.StatusCode);
        var memberId = await GuestCalls.MemberIdAsync(first);
        Assert.Equal(memberId, await GuestCalls.MemberIdAsync(again));
        Assert.NotEqual(memberId, await GuestCalls.MemberIdAsync(elsewhere));
        Assert.Equal(1, await GuestCalls.CountAsync(api.ConnectionString, world.GroupId));
        Assert.Equal(Leo, (await GuestCalls.ReadAsync(api.ConnectionString, memberId))!.Name);
    }

    /// <summary>H5: every refused body is a 400 and creates nothing; the control right after is a 201.</summary>
    [Theory]
    [InlineData("""{"requestId":"0195f3c4-0000-7000-8000-000000000001","name":"Léo","userId":"canario-123"}""", null)]
    [InlineData("""{"requestId":"0195f3c4-0000-7000-8000-000000000001","name":null}""", GuestCalls.GuestNameInvalid)]
    [InlineData("""{"requestId":"0195f3c4-0000-7000-8000-000000000001","name":"   "}""", GuestCalls.GuestNameInvalid)]
    [InlineData("""{"requestId":"0195f3c4-0000-7000-8000-000000000001","name":"aaaaaaaaaaaaaaaaaaaaa"}""", GuestCalls.GuestNameInvalid)]
    [InlineData("""{"requestId":"0195f3c4-0000-7000-8000-000000000001","name":"Léo","level":4.25}""", LevelCalls.LevelInvalid)]
    [InlineData("""{"requestId":"0195f3c4-0000-7000-8000-000000000001","name":"Léo","level":"4.0"}""", null)]
    [InlineData("""{"requestId":"canario-123","name":"Léo"}""", null)]
    [InlineData("""{"requestId":"00000000-0000-0000-0000-000000000000","name":"Léo"}""", GuestCalls.GuestInvalid)]
    [InlineData("""{"requestId":"0195f3c4-0000-7000-8000-000000000001","name":"Léo","primaryPosition":"any"}""", GuestCalls.GuestInvalid)]
    [InlineData("""{"requestId":"0195f3c4-0000-7000-8000-000000000001","name":"Léo","primaryPosition":"Goleiro"}""", GuestCalls.GuestInvalid)]
    [InlineData("""{"requestId":"0195f3c4-0000-7000-8000-000000000001","name":"Léo","role":"admin"}""", null)]
    [InlineData("""{"name":"Léo"}""", null)]
    [InlineData("""[]""", null)]
    public async Task RefusedBody_IsABadRequest_AndCreatesNothing(string json, string? code)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var refused = await world.SendAsync(A.Admin, HttpMethod.Post, GuestCalls.GuestsPath(world), json);
        var text = await refused.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        var count = await GuestCalls.CountAsync(api.ConnectionString, world.GroupId);
        using var control = await GuestCalls.AddAsync(world, "Controle", position: "SETTER");

        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
        Assert.Equal(code, await SettingsCalls.CodeAsync(refused));
        Assert.DoesNotContain("canario", text, StringComparison.Ordinal);
        Assert.DoesNotContain("Léo", text, StringComparison.Ordinal);
        Assert.Equal(0, count);
        Assert.Equal(HttpStatusCode.Created, control.StatusCode);
        Assert.Equal("setter", (await GuestCalls.ReadAsync(api.ConnectionString, await GuestCalls.MemberIdAsync(control)))!.PrimaryPosition);
    }

    /// <summary>The limits on the wire, as literals: 20 characters pass, 21 do not.</summary>
    [Fact]
    public async Task NameOfTwentyCharacters_Passes_AndTwentyOneIsRefused()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var twenty = await GuestCalls.AddAsync(world, new string('b', 20));
        using var twentyOne = await GuestCalls.AddAsync(world, new string('b', 21));

        Assert.Equal(HttpStatusCode.Created, twenty.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, twentyOne.StatusCode);
        Assert.Equal(GuestCalls.GuestNameInvalid, await SettingsCalls.CodeAsync(twentyOne));
    }

    /// <summary>H6 and D9: the correction replaces the profile and clears the position; a member with an account is a 404.</summary>
    [Fact]
    public async Task Correction_ReplacesTheProfile_AndAMemberWithAnAccountIsNotFound()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var guest = await GuestCalls.CreateAsync(world, Leo, position: "libero");

        using var corrected = await world.SendAsync(A.Admin, HttpMethod.Put, GuestCalls.GuestPath(world, guest), GuestCalls.CorrectBody("Leonardo", null));
        using var account = await world.SendAsync(
            A.Admin, HttpMethod.Put, GuestCalls.GuestPath(world, world.MemberIds[A.Player]), GuestCalls.CorrectBody("Leonardo", null));
        using var missing = await world.SendAsync(A.Admin, HttpMethod.Put, GuestCalls.GuestPath(world, Guid.NewGuid()), GuestCalls.CorrectBody("Leonardo", null));
        using var partial = await world.SendAsync(A.Admin, HttpMethod.Put, GuestCalls.GuestPath(world, guest), """{"name":"Sem posição"}""");

        Assert.Equal(HttpStatusCode.OK, corrected.StatusCode);
        Assert.Equal("no-store", corrected.Headers.CacheControl?.ToString());
        var body = await RoundCalls.JsonAsync(corrected);
        Assert.Equal((guest, "Leonardo"), (body["memberId"]!.GetValue<Guid>(), body["name"]!.GetValue<string>()));
        Assert.Null(body["primaryPosition"]);
        Assert.Equal(new GuestState(world.GroupId, "Leonardo", null), await GuestCalls.ReadAsync(api.ConnectionString, guest));
        Assert.Equal(HttpStatusCode.NotFound, account.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Equal(await BodyWithoutTraceAsync(missing), await BodyWithoutTraceAsync(account));
        Assert.Equal(HttpStatusCode.BadRequest, partial.StatusCode);
        Assert.Null(await GuestCalls.ReadAsync(api.ConnectionString, world.MemberIds[A.Player]));
    }

    /// <summary>D8: a guest is a player and a drop-in for ever; the role route refuses the others with its own code.</summary>
    [Fact]
    public async Task Guest_NeverGetsARoleThatNeedsTheApp_NorBecomesARegular()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var guest = await GuestCalls.CreateAsync(world);

        using var scorekeeper = await world.SendAsync(A.Admin, HttpMethod.Put, world.MemberPath(guest) + "/role", """{"role":"scorekeeper"}""");
        using var coAdmin = await world.SendAsync(A.Admin, HttpMethod.Put, world.MemberPath(guest) + "/role", """{"role":"coAdmin"}""");
        using var player = await world.SendAsync(A.Admin, HttpMethod.Put, world.MemberPath(guest) + "/role", """{"role":"player"}""");
        using var regular = await world.SendAsync(A.Admin, HttpMethod.Put, world.MemberPath(guest) + "/type", """{"memberType":"regular"}""");

        Assert.Equal(GuestCalls.RoleNeedsAccount, await SettingsCalls.CodeAsync(scorekeeper));
        Assert.Equal(GuestCalls.RoleNeedsAccount, await SettingsCalls.CodeAsync(coAdmin));
        Assert.Equal(HttpStatusCode.OK, player.StatusCode);
        Assert.Equal("groups.regular-needs-account", await SettingsCalls.CodeAsync(regular));
        Assert.Equal(new MemberState("player", "drop_in", "active", HasLeftAt: false), await MemberRows.ReadAsync(api.ConnectionString, guest));
    }

    /// <summary>H7, L3 and D9: removing the guest deletes its row; its attendance stays, by member id only.</summary>
    [Fact]
    public async Task RemovingTheGuest_DeletesTheName_AndKeepsTheHistoryById()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world);
        var round = (await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>();
        var guest = await GuestCalls.CreateAsync(world, Leo, level: "2.0");
        Assert.Equal(HttpStatusCode.OK, await RoundCalls.SetAsync(world, round, guest, going: true));

        using var removed = await world.SendAsync(A.Admin, HttpMethod.Delete, world.MemberPath(guest));
        using var correctedAfter = await world.SendAsync(A.Admin, HttpMethod.Put, GuestCalls.GuestPath(world, guest), GuestCalls.CorrectBody("Volta", null));

        Assert.Equal(HttpStatusCode.NoContent, removed.StatusCode);
        Assert.Null(await GuestCalls.ReadAsync(api.ConnectionString, guest));
        Assert.Empty(await GuestCalls.FindTextAsync(api.ConnectionString, "Canário"));
        Assert.Equal("removed", (await MemberRows.ReadAsync(api.ConnectionString, guest)).Status);
        Assert.Contains(await RoundCalls.RowsAsync(api.ConnectionString, round), row => row.MemberId == guest);
        Assert.DoesNotContain(guest, (await GuestCalls.MembersAsync(world)).Keys);
        Assert.Equal(HttpStatusCode.NotFound, correctedAfter.StatusCode);
        Assert.Equal(LevelCalls.MemberNotFound, await SettingsCalls.CodeAsync(correctedAfter));
        Assert.Null(await GuestCalls.ReadAsync(api.ConnectionString, guest));
    }

    /// <summary>
    /// L1, L4 and D12: across every guest route, refusals included, no log carries the name or the request id, and no
    /// response carries a user id, the level or the request id. The responses with the name are not cached.
    /// </summary>
    [Fact]
    public async Task NoLogOrResponse_CarriesTheNameTheRequestIdOrTheLevel()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var requestId = Guid.NewGuid();
        var start = api.Logs.Count;
        var responses = new List<HttpResponseMessage>
        {
            await GuestCalls.AddAsync(world, Leo, requestId, level: "4.5"),
            await GuestCalls.AddAsync(world, Leo, requestId, level: "4.5"),
            await GuestCalls.AddAsync(world, Leo, actor: A.Player),
            await GuestCalls.AddAsync(world, Leo, position: "goleiro"),
            await GuestCalls.AddAsync(world, Leo + new string('x', 30)),
        };
        var guest = await GuestCalls.MemberIdAsync(responses[0]);
        responses.Add(await world.SendAsync(A.Admin, HttpMethod.Put, GuestCalls.GuestPath(world, guest), GuestCalls.CorrectBody(Leo, "opposite")));
        responses.Add(await world.SendAsync(A.Admin, HttpMethod.Put, GuestCalls.GuestPath(world, world.MemberIds[A.Player]), GuestCalls.CorrectBody(Leo, null)));
        responses.Add(await world.SendAsync(A.Admin, HttpMethod.Put, world.MemberPath(guest) + "/role", """{"role":"admin"}"""));
        responses.Add(await world.SendAsync(A.Admin, HttpMethod.Get, world.GroupPath + "/members"));
        responses.Add(await world.SendAsync(A.Admin, HttpMethod.Delete, world.MemberPath(guest)));

        string[] secrets = ["Canário", "Canario", requestId.ToString(), requestId.ToString("N")];
        Assert.DoesNotContain(api.Logs.EntriesSince(start), entry => secrets.Any(value => entry.Contains(value, StringComparison.OrdinalIgnoreCase)));
        foreach (var response in responses)
        {
            var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
            Assert.DoesNotContain(requestId.ToString(), text, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("userId", text, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("level", text, StringComparison.OrdinalIgnoreCase);
            response.Dispose();
        }

        Assert.Equal("no-store", responses[8].Headers.CacheControl?.ToString());
    }

    private static async Task<string> BodyWithoutTraceAsync(HttpResponseMessage response)
    {
        var body = await RoundCalls.JsonAsync(response);
        body.Remove("traceId");
        return body.ToJsonString();
    }
}
