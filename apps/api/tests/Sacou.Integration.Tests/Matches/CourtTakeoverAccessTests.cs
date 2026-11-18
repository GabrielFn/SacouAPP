using System.Net;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Sessions;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Matches;

/// <summary>
/// A2 of E3.8 (ADR 0063, D4, D5 and D7): the takeover, the summary and the stream read only for <c>WriteCourt</c>.
/// Admin, co-admin and scorekeeper get 200; the player is forbidden; a non-member, a member who left or was removed get
/// the 404 of a missing group; a round of another group is the 404 of a missing round; a stream of another round is
/// the 404 of a missing stream.
/// </summary>
public sealed class CourtTakeoverAccessTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string Summary = "summary";
    private const string Events = "events";
    private const string Takeover = "takeover";
    private const string CourtSessionNotFound = "matches.court-session-not-found";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    public static readonly TheoryData<string, A, HttpStatusCode, string?> Matrix = Build();

    [Theory]
    [MemberData(nameof(Matrix))]
    public async Task EachActor_GetsItsAnswer(string route, A actor, HttpStatusCode status, string? code)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);

        using var response = await CallAsync(world, actor, route, round, phone);

        Assert.Equal(status, response.StatusCode);
        if (status != HttpStatusCode.OK)
        {
            Assert.Equal(code, await RoundCalls.CodeAsync(response));
            Assert.Equal(1, await CourtCalls.CountAsync(api.ConnectionString, "SELECT count(*) FROM matches.court_writers WHERE court_session_id = @id", phone.CourtSessionId));
        }
    }

    /// <summary>A round of another group is the 404 of a missing round; another round's stream, the 404 of no stream, byte for byte.</summary>
    [Theory]
    [InlineData(Summary)]
    [InlineData(Events)]
    [InlineData(Takeover)]
    public async Task OtherRoundsAndStreams_AreNotFound(string route)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var otherWorld = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var empty = await CourtCalls.RoundAsync(world);
        var otherGroupRound = await CourtCalls.RoundAsync(otherWorld);
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);

        using var otherGroup = await CallAsync(world, A.Admin, route, otherGroupRound, phone);
        using var otherRound = await CallAsync(world, A.Admin, route, empty, phone);
        using var missing = await CallAsync(world, A.Admin, route, empty, CourtPhone.New());

        Assert.Equal(HttpStatusCode.NotFound, otherGroup.StatusCode);
        Assert.Equal(CourtCalls.RoundNotFound, await RoundCalls.CodeAsync(otherGroup));
        Assert.Equal(HttpStatusCode.NotFound, otherRound.StatusCode);
        Assert.Equal(CourtSessionNotFound, await RoundCalls.CodeAsync(otherRound));
        Assert.Equal(await CourtCalls.ProblemWithoutTraceAsync(missing), await CourtCalls.ProblemWithoutTraceAsync(otherRound));
    }

    private static Task<HttpResponseMessage> CallAsync(GroupWorld world, A actor, string route, string round, CourtPhone phone) => route switch
    {
        Summary => world.SendAsync(actor, HttpMethod.Get, CourtCalls.SummaryPath(world, round)),
        Events => world.SendAsync(actor, HttpMethod.Get, CourtCalls.EventsPath(world, round, phone.CourtSessionId)),
        _ => CourtCalls.TakeOverAsync(world, actor, round, phone.TakingOver(batch: 2), expectedBatch: 1, expectedEventCount: 1),
    };

    private static TheoryData<string, A, HttpStatusCode, string?> Build()
    {
        (A Actor, HttpStatusCode Status, string? Code)[] answers =
        [
            (A.Admin, HttpStatusCode.OK, null),
            (A.CoAdmin, HttpStatusCode.OK, null),
            (A.Scorekeeper, HttpStatusCode.OK, null),
            (A.Player, HttpStatusCode.Forbidden, RoundCalls.Forbidden),
            (A.LeftMember, HttpStatusCode.NotFound, RoundCalls.GroupNotFound),
            (A.RemovedMember, HttpStatusCode.NotFound, RoundCalls.GroupNotFound),
            (A.NonMember, HttpStatusCode.NotFound, RoundCalls.GroupNotFound),
            (A.Anonymous, HttpStatusCode.Unauthorized, null),
        ];
        var data = new TheoryData<string, A, HttpStatusCode, string?>();
        foreach (var route in new[] { Summary, Events, Takeover })
        {
            foreach (var (actor, status, code) in answers)
            {
                data.Add(route, actor, status, code);
            }
        }

        return data;
    }
}
