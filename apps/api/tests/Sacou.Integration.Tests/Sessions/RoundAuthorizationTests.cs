using System.Net;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;
using Sacou.Integration.Tests.Groups;

namespace Sacou.Integration.Tests.Sessions;

/// <summary>The eight round routes of the plan (E3.4, "Rotas").</summary>
public enum RoundRoute
{
    Create = 1,
    List,
    Get,
    Update,
    Cancel,
    RespondMe,
    SetMember,
    StopSeries,
}

/// <summary>
/// M1 to M4 of E3.4 on the real API and a real Postgres. The expected status of each cell is written by hand
/// from the permission table (docs/dominio/grupos.md), never read from the production table.
/// </summary>
public sealed class RoundAuthorizationTests(IntegrationDatabase database) : IAsyncLifetime
{
    private readonly ApiWithDatabase api = new(database);

    public static TheoryData<A, RoundRoute> Cells()
    {
        var cells = new TheoryData<A, RoundRoute>();
        foreach (var actor in Enum.GetValues<A>())
        {
            foreach (var route in Enum.GetValues<RoundRoute>())
            {
                cells.Add(actor, route);
            }
        }

        return cells;
    }

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Theory]
    [MemberData(nameof(Cells))]
    public async Task Matrix_EveryActorOnEveryRoundRoute(A actor, RoundRoute route)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world);
        var round = await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(repeat: true));
        var (method, path, json) = Request(world, route, round["roundId"]!.GetValue<string>(), round["seriesId"]!.GetValue<string>());

        using var response = await world.SendAsync(actor, method, path, json);

        var (status, code) = Expected(actor, route);
        Assert.Equal(status, response.StatusCode);
        Assert.Equal(code, await RoundCalls.CodeAsync(response));
    }

    /// <summary>M2: the 404 of a non-member is the same body as the Groups' own and as a group that does not exist.</summary>
    [Fact]
    public async Task NonMember404_IsByteForByteTheGroupsAnswer()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        using var rounds = await world.SendAsync(A.NonMember, HttpMethod.Get, RoundCalls.RoundsPath(world));
        using var groups = await world.SendAsync(A.NonMember, HttpMethod.Get, world.GroupPath);
        using var missing = await world.SendAsync(A.NonMember, HttpMethod.Get, $"{GroupWorld.GroupsPath}/{Guid.NewGuid()}/rounds");

        var round = await RoundCalls.JsonAsync(rounds);
        var group = await RoundCalls.JsonAsync(groups);
        var gone = await RoundCalls.JsonAsync(missing);
        _ = round.Remove("traceId");
        _ = group.Remove("traceId");
        _ = gone.Remove("traceId");
        Assert.Equal(group.ToJsonString(), round.ToJsonString());
        Assert.Equal(group.ToJsonString(), gone.ToJsonString());
    }

    /// <summary>M3: a round and a series of group B through group A's route are not found, and nothing changes in B.</summary>
    [Fact]
    public async Task RoundAndSeriesOfAnotherGroup_AreNotFoundAndUntouched()
    {
        using var client = api.CreateClient();
        var a = await GroupWorld.CreateAsync(api, client, "Racha A");
        var b = await GroupWorld.CreateAsync(api, client, "Racha B");
        await RoundCalls.ConfigureAttendanceAsync(b);
        var inB = await RoundCalls.CreateAsync(b, RoundCalls.CreateBody(repeat: true));
        var roundB = inB["roundId"]!.GetValue<string>();
        var seriesB = inB["seriesId"]!.GetValue<string>();

        using var read = await a.SendAsync(A.Admin, HttpMethod.Get, RoundCalls.RoundPath(a, roundB));
        using var cancel = await a.SendAsync(A.Admin, HttpMethod.Post, RoundCalls.RoundPath(a, roundB) + "/cancel");
        using var stop = await a.SendAsync(A.Admin, HttpMethod.Post, $"{a.GroupPath}/series/{seriesB}/stop");

        Assert.Equal("sessions.round-not-found", await RoundCalls.CodeAsync(read));
        Assert.Equal("sessions.round-not-found", await RoundCalls.CodeAsync(cancel));
        Assert.Equal("sessions.series-not-found", await RoundCalls.CodeAsync(stop));
        Assert.Equal("scheduled", (await RoundCalls.GetAsync(b, roundB))["status"]!.GetValue<string>());
    }

    /// <summary>M3: a member id of another group, or of one who left or was removed, is the same <c>member-not-found</c>.</summary>
    [Fact]
    public async Task TargetMemberOutsideTheGroup_IsMemberNotFound()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world);
        var round = (await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>();

        foreach (var target in new[] { world.MemberIds[A.OutsiderMember], world.MemberIds[A.LeftMember], world.MemberIds[A.RemovedMember], Guid.NewGuid() })
        {
            Assert.Equal(HttpStatusCode.NotFound, await RoundCalls.SetAsync(world, round, target, going: true));
        }

        Assert.Equal(HttpStatusCode.OK, await RoundCalls.SetAsync(world, round, world.MemberIds[A.Player], going: true));
        Assert.Single(await RoundCalls.RowsAsync(api.ConnectionString, round));
    }

    /// <summary>M4: fields the body must not carry, and values it must not have, are a 400.</summary>
    [Theory]
    [InlineData("""{"response":"going","status":"going"}""")]
    [InlineData("""{"response":"going","memberId":"00000000-0000-0000-0000-000000000001"}""")]
    [InlineData("""{"response":"going","sequence":1}""")]
    [InlineData("""{"response":"maybe"}""")]
    [InlineData("""{"response":null}""")]
    [InlineData("""{"response":1}""")]
    [InlineData("""{}""")]
    public async Task AttendanceBody_WithExtrasOrBadValues_IsRefused(string json)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world);
        var round = (await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>();

        using var response = await world.SendAsync(A.Player, HttpMethod.Put, RoundCalls.RoundPath(world, round) + "/attendance/me", json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(await RoundCalls.RowsAsync(api.ConnectionString, round));
    }

    [Theory]
    [InlineData("""{"localDate":"2030-01-01","localTime":"20:30","venue":"x","roundId":"00000000-0000-0000-0000-000000000001"}""")]
    [InlineData("""{"localDate":"2030-01-01","localTime":"20:30","groupId":"00000000-0000-0000-0000-000000000001"}""")]
    public async Task CreateBody_WithIdentityFields_IsRefused(string json)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await world.SendAsync(A.Admin, HttpMethod.Post, RoundCalls.RoundsPath(world), json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    /// <summary>The lookup number of the access filter (1) and of the one under the round's lock (2).</summary>
    private const int LookupUnderTheLock = 2;

    /// <summary>M5: the admin is demoted after the filter let the request in and before the lock is used: the lock-time lookup wins (403), nothing is written.</summary>
    [Fact]
    public async Task AdminDemotedBetweenTheFilterAndTheLock_IsForbidden_AndTheRoundIsUntouched()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world);
        var round = (await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>();
        var coAdmin = world.MemberIds[A.CoAdmin];
        var filterAllowed = false;
        api.BeforeMembershipLookup = async lookup =>
        {
            if (lookup == LookupUnderTheLock)
            {
                filterAllowed = true;
                await MemberRows.SetRoleAsync(api.ConnectionString, coAdmin, "player");
            }
        };

        using var response = await world.SendAsync(
            A.CoAdmin, HttpMethod.Put, $"{RoundCalls.RoundPath(world, round)}/attendance/{world.MemberIds[A.Player]}", RoundCalls.Response(true));

        Assert.True(filterAllowed, "The request must have passed the filter as a co-admin before the demotion.");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(RoundCalls.Forbidden, await RoundCalls.CodeAsync(response));
        Assert.Empty(await RoundCalls.RowsAsync(api.ConnectionString, round));
    }

    /// <summary>M5: removed from the group between the filter and the lock: the non-member 404 of route 6, nothing written.</summary>
    [Fact]
    public async Task PlayerRemovedBetweenTheFilterAndTheLock_IsNotFound_AndTheRoundIsUntouched()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world);
        var round = (await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>();
        var player = world.MemberIds[A.Player];
        api.BeforeMembershipLookup = async lookup =>
        {
            if (lookup == LookupUnderTheLock)
            {
                await MemberRows.RemoveAsync(api.ConnectionString, player);
            }
        };

        using var response = await world.SendAsync(A.Player, HttpMethod.Put, RoundCalls.RoundPath(world, round) + "/attendance/me", RoundCalls.Response(true));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(RoundCalls.GroupNotFound, await RoundCalls.CodeAsync(response));
        Assert.Empty(await RoundCalls.RowsAsync(api.ConnectionString, round));
    }

    /// <summary>M6: the answer never carries a user id, e-mail, name or the creator.</summary>
    [Fact]
    public async Task Responses_NeverCarryPersonalFields()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world);
        var round = (await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>();
        _ = await RoundCalls.RespondAsync(world, world.Subjects[A.Player], round, going: true);

        using var response = await world.SendAsync(A.Admin, HttpMethod.Get, RoundCalls.RoundPath(world, round));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        foreach (var forbidden in new[] { "userId", "email", "name", "createdBy", world.Users[A.Player].ToString() })
        {
            Assert.DoesNotContain(forbidden, text, StringComparison.OrdinalIgnoreCase);
        }
    }

    private static (HttpMethod Method, string Path, string? Json) Request(GroupWorld world, RoundRoute route, string round, string series) => route switch
    {
        RoundRoute.Create => (HttpMethod.Post, RoundCalls.RoundsPath(world), RoundCalls.CreateBody(RoundCalls.FutureDate(5))),
        RoundRoute.List => (HttpMethod.Get, RoundCalls.RoundsPath(world), null),
        RoundRoute.Get => (HttpMethod.Get, RoundCalls.RoundPath(world, round), null),
        RoundRoute.Update => (HttpMethod.Patch, RoundCalls.RoundPath(world, round), """{"venue":"Areia"}"""),
        RoundRoute.Cancel => (HttpMethod.Post, RoundCalls.RoundPath(world, round) + "/cancel", null),
        RoundRoute.RespondMe => (HttpMethod.Put, RoundCalls.RoundPath(world, round) + "/attendance/me", RoundCalls.Response(true)),
        RoundRoute.SetMember => (HttpMethod.Put, $"{RoundCalls.RoundPath(world, round)}/attendance/{world.MemberIds[A.Player]}", RoundCalls.Response(true)),
        RoundRoute.StopSeries => (HttpMethod.Post, $"{world.GroupPath}/series/{series}/stop", null),
        _ => throw new ArgumentOutOfRangeException(nameof(route), route, "Every route needs a request."),
    };

    /// <summary>Readers and players: lists, detail and their own answer. Only the admin and the co-admin manage rounds.</summary>
    private static (HttpStatusCode Status, string? Code) Expected(A actor, RoundRoute route)
    {
        switch (actor)
        {
            case A.Anonymous:
                return (HttpStatusCode.Unauthorized, null);
            case A.Unregistered:
                return (HttpStatusCode.Forbidden, RoundCalls.NotRegistered);
            case A.LeftMember or A.RemovedMember or A.OutsiderMember or A.NonMember:
                return (HttpStatusCode.NotFound, RoundCalls.GroupNotFound);
            case A.Scorekeeper or A.Player when route is not (RoundRoute.List or RoundRoute.Get or RoundRoute.RespondMe):
                return (HttpStatusCode.Forbidden, RoundCalls.Forbidden);
            default:
                return (route switch
                {
                    RoundRoute.Create => HttpStatusCode.Created,
                    RoundRoute.StopSeries => HttpStatusCode.NoContent,
                    _ => HttpStatusCode.OK,
                }, null);
        }
    }
}
