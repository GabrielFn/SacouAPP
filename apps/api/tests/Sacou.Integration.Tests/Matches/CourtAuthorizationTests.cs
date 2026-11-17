using System.Net;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Sessions;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Matches;

/// <summary>
/// A3 of E3.7: who may write the court (ADR 0060, D5). Admin, co-admin and scorekeeper write; the player is forbidden;
/// a non-member, a member who left or was removed, and a member of another group get the 404 of a missing group.
/// </summary>
public sealed class CourtAuthorizationTests(IntegrationDatabase database) : IAsyncLifetime
{
    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Theory]
    [InlineData(A.Admin, HttpStatusCode.OK, null)]
    [InlineData(A.CoAdmin, HttpStatusCode.OK, null)]
    [InlineData(A.Scorekeeper, HttpStatusCode.OK, null)]
    [InlineData(A.Player, HttpStatusCode.Forbidden, RoundCalls.Forbidden)]
    [InlineData(A.LeftMember, HttpStatusCode.NotFound, RoundCalls.GroupNotFound)]
    [InlineData(A.RemovedMember, HttpStatusCode.NotFound, RoundCalls.GroupNotFound)]
    [InlineData(A.OutsiderMember, HttpStatusCode.NotFound, RoundCalls.GroupNotFound)]
    [InlineData(A.NonMember, HttpStatusCode.NotFound, RoundCalls.GroupNotFound)]
    [InlineData(A.Unregistered, HttpStatusCode.Forbidden, RoundCalls.NotRegistered)]
    [InlineData(A.Anonymous, HttpStatusCode.Unauthorized, null)]
    public async Task EachActor_GetsItsAnswer(A actor, HttpStatusCode status, string? code)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();

        using var response = await CourtCalls.SendAsync(world, actor, round, phone, [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);

        Assert.Equal(status, response.StatusCode);
        if (status != HttpStatusCode.OK)
        {
            Assert.Equal(code, await RoundCalls.CodeAsync(response));
            Assert.Equal(0, await CourtCalls.CountAsync(api.ConnectionString, "SELECT count(*) FROM matches.court_sessions WHERE id = @id", phone.CourtSessionId));
        }
    }

    /// <summary>The 404 of a non-member is byte for byte the one of a group that does not exist.</summary>
    [Fact]
    public async Task NonMember_GetsTheBodyOfAMissingGroup()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        var body = CourtPhone.Body([phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);

        using var nonMember = await world.SendAsync(A.NonMember, HttpMethod.Post, CourtCalls.EventsPath(world, round, phone.CourtSessionId), body);
        using var missing = await world.SendAsync(A.NonMember, HttpMethod.Post,
            $"{GroupWorld.GroupsPath}/{Guid.NewGuid()}/rounds/{round}/court-sessions/{phone.CourtSessionId}/events", body);

        Assert.Equal(await CourtCalls.ProblemWithoutTraceAsync(missing), await CourtCalls.ProblemWithoutTraceAsync(nonMember));
    }
}
