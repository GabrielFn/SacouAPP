using System.Net;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Groups;

/// <summary>
/// E6.6 on the real API and a real Postgres: who may report, whom, the repetition that writes once, the refusals that
/// write nothing and the log line without ids (criteria 6 to 11 and 14).
/// </summary>
public sealed class ContentReportsTests(IntegrationDatabase database) : IAsyncLifetime
{
    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>Criteria 1 and 6: every active role reports another member; the reporter is the caller's member id.</summary>
    [Theory]
    [InlineData(A.Admin)]
    [InlineData(A.CoAdmin)]
    [InlineData(A.Scorekeeper)]
    [InlineData(A.Player)]
    public async Task EveryRole_ReportsAnotherMember_AsOneRowOfIds(A actor)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var target = actor == A.Admin ? world.MemberIds[A.Player] : world.MemberIds[A.Admin];

        using var response = await ReportCalls.ReportAsync(world, actor, target, "impersonation");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var row = Assert.Single(await ReportCalls.RowsAsync(api.ConnectionString, world.GroupId));
        Assert.Equal(new { Reporter = world.MemberIds[actor], Reported = (Guid?)target, Reason = "impersonation" }, new { row.Reporter, row.Reported, row.Reason });
    }

    /// <summary>Criterion 6: the same report twice is two 204s and one row; another reason is a second row.</summary>
    [Fact]
    public async Task SameReportTwice_IsOneRow_AnotherReasonIsAnother()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var target = world.MemberIds[A.Admin];

        using var first = await ReportCalls.ReportAsync(world, A.Player, target, "spam");
        using var again = await ReportCalls.ReportAsync(world, A.Player, target, "spam");
        using var other = await ReportCalls.ReportAsync(world, A.Player, target, "hateOrSexual");

        Assert.All(new[] { first, again, other }, response => Assert.Equal(HttpStatusCode.NoContent, response.StatusCode));
        Assert.Equal(["hate_or_sexual", "spam"], (await ReportCalls.RowsAsync(api.ConnectionString, world.GroupId)).Select(row => row.Reason).Order(StringComparer.Ordinal));
    }

    /// <summary>Criterion 14: the group's report (null member) repeats once too (nulls not distinct).</summary>
    [Fact]
    public async Task GroupReportTwice_IsOneRow_WithoutAMember()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var first = await ReportCalls.ReportAsync(world, A.Scorekeeper, null, "offensiveName");
        using var again = await ReportCalls.ReportAsync(world, A.Scorekeeper, null, "offensiveName");

        Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, again.StatusCode);
        var row = Assert.Single(await ReportCalls.RowsAsync(api.ConnectionString, world.GroupId));
        Assert.Null(row.Reported);
        Assert.Equal(world.MemberIds[A.Scorekeeper], row.Reporter);
    }

    /// <summary>Criterion 8: one who left or was removed is still reported (the name stays in the history).</summary>
    [Theory]
    [InlineData(A.LeftMember)]
    [InlineData(A.RemovedMember)]
    public async Task FormerMember_IsReported(A former)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await ReportCalls.ReportAsync(world, A.Player, world.MemberIds[former]);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Single(await ReportCalls.RowsAsync(api.ConnectionString, world.GroupId));
    }

    /// <summary>Criteria 7 and 8: oneself is 400, a member of another group or nobody is 404; nothing is written.</summary>
    [Fact]
    public async Task SelfOtherGroupAndNobody_AreRefused_AndWriteNothing()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var self = await ReportCalls.ReportAsync(world, A.Player, world.MemberIds[A.Player]);
        using var outsider = await ReportCalls.ReportAsync(world, A.Player, world.MemberIds[A.OutsiderMember]);
        using var nobody = await ReportCalls.ReportAsync(world, A.Player, Guid.NewGuid());

        Assert.Equal(HttpStatusCode.BadRequest, self.StatusCode);
        Assert.Equal("groups.report-self", await ReportCalls.CodeAsync(self));
        Assert.Equal(HttpStatusCode.NotFound, outsider.StatusCode);
        Assert.Equal("groups.member-not-found", await ReportCalls.CodeAsync(outsider));
        Assert.Equal(HttpStatusCode.NotFound, nobody.StatusCode);
        Assert.Equal("groups.member-not-found", await ReportCalls.CodeAsync(nobody));
        Assert.Empty(await ReportCalls.RowsAsync(api.ConnectionString, world.GroupId));
    }

    /// <summary>Criterion 9: a reason off the list, a missing one, a missing member field or free text are 400.</summary>
    [Theory]
    [InlineData("""{"reportedMemberId":null,"reason":"other"}""")]
    [InlineData("""{"reportedMemberId":null}""")]
    [InlineData("""{"reason":"spam"}""")]
    [InlineData("""{"reportedMemberId":null,"reason":0}""")]
    [InlineData("""{"reportedMemberId":null,"reason":"spam","text":"xingou"}""")]
    public async Task BadBody_IsRefused_AndWritesNothing(string body)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await world.SendAsync(A.Player, HttpMethod.Post, ReportCalls.Path(world), body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(await ReportCalls.RowsAsync(api.ConnectionString, world.GroupId));
    }

    /// <summary>Criterion 10: who is not an active member gets what the other group routes give, and nothing is written.</summary>
    [Theory]
    [InlineData(A.LeftMember, HttpStatusCode.NotFound)]
    [InlineData(A.RemovedMember, HttpStatusCode.NotFound)]
    [InlineData(A.OutsiderMember, HttpStatusCode.NotFound)]
    [InlineData(A.NonMember, HttpStatusCode.NotFound)]
    [InlineData(A.Anonymous, HttpStatusCode.Unauthorized)]
    public async Task NotAnActiveMember_IsRefused_AndWritesNothing(A actor, HttpStatusCode expected)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);

        using var response = await ReportCalls.ReportAsync(world, actor, world.MemberIds[A.Admin]);

        Assert.Equal(expected, response.StatusCode);
        Assert.Empty(await ReportCalls.RowsAsync(api.ConnectionString, world.GroupId));
    }

    /// <summary>Criterion 11 (L1): one line for the alert, once per new row, with no nickname, user, uid nor member id.</summary>
    [Fact]
    public async Task Log_SaysOnlyThatAReportArrived()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client, groupName: "Racha Marcador Zebra");
        var start = api.Logs.Count;

        using var first = await ReportCalls.ReportAsync(world, A.Player, world.MemberIds[A.Admin]);
        using var again = await ReportCalls.ReportAsync(world, A.Player, world.MemberIds[A.Admin]);
        using var group = await ReportCalls.ReportAsync(world, A.Player, null);

        var logged = api.Logs.EntriesSince(start);
        Assert.Equal(2, logged.Count(entry => entry.Contains("Content report received.", StringComparison.Ordinal)));
        string[] secrets =
        [
            "Zebra", world.Subjects[A.Player], world.Users[A.Player].ToString(),
            world.MemberIds[A.Player].ToString(), world.MemberIds[A.Admin].ToString(), "offensive",
        ];
        Assert.DoesNotContain(logged, entry => secrets.Any(secret => entry.Contains(secret, StringComparison.OrdinalIgnoreCase)));
    }
}
