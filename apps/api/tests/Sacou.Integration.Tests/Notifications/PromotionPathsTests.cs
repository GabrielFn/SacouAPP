using System.Globalization;
using System.Net;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Sessions;
using Sacou.Modules.Notifications.Contracts;
using Xunit;
using N = Sacou.Integration.Tests.Notifications.NotificationCalls;

namespace Sacou.Integration.Tests.Notifications;

/// <summary>
/// I2, I4, I5 and I9 of E3.11: every way a round write promotes someone goes through the outbox, a write that is
/// undone leaves nothing, and only an active member with an account is told. Also the list of a former member.
/// </summary>
public sealed class PromotionPathsTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int DaysInWeek = 7;
    private const int Capacity = 12;
    private const int Racers = 16;
    private const string RaiseToTwo = """{"settings":{"schemaVersion":1,"attendance":{"capacity":2}}}""";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task I2_AWriteUndoneByTheTakenDate_OrRefused_LeavesNoOutboxRow()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var (created, _, waiting) = await N.WaitlistRoundAsync(world, RoundCalls.CreateBody(repeat: true));
        var round = created["roundId"]!.GetValue<string>();
        _ = await N.ExecuteAsync(
            api.ConnectionString,
            "INSERT INTO sessions.rounds (id, group_id, series_id, local_date, local_time, time_zone, starts_at, venue, status, next_sequence, created_at) " +
            $"SELECT gen_random_uuid(), group_id, series_id, local_date + {DaysInWeek}, local_time, time_zone, starts_at + interval '{DaysInWeek} days', venue, status, next_sequence, created_at " +
            "FROM sessions.rounds WHERE id = @round",
            ("round", Guid.Parse(round)));
        var moveAndRaise = "{\"localDate\":\"" + WeekLater(created) + "\"," + RaiseToTwo[1..];

        using var undone = await world.SendAsync(GroupActor.Admin, HttpMethod.Patch, RoundCalls.RoundPath(world, round), moveAndRaise);
        using var refused = await world.SendAsync(GroupActor.Player, HttpMethod.Patch, RoundCalls.RoundPath(world, round), RaiseToTwo);

        Assert.Equal(HttpStatusCode.Conflict, undone.StatusCode);
        Assert.Equal("sessions.round-date-taken", await RoundCalls.CodeAsync(undone));
        Assert.Equal(HttpStatusCode.Forbidden, refused.StatusCode);
        Assert.Equal(0, await N.OutboxOfRoundAsync(api.ConnectionString, round));
        Assert.Equal("waitlisted", (await RoundCalls.RowsAsync(api.ConnectionString, round)).Single(row => row.MemberId == waiting.MemberId).Status);
        Assert.Equal(0, await N.NotificationsOfMemberAsync(api.ConnectionString, waiting.MemberId));
    }

    [Fact]
    public async Task I4_SixteenAtTheLastSpot_ThenANotGoing_IsOnePromotion_ForTheFirstInLine()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world, Capacity);
        var round = (await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>();
        var fillers = new List<(string Subject, Guid MemberId)>();
        for (var index = 0; index < Capacity - 1; index++)
        {
            var filler = await world.AddPersonAsync();
            Assert.Equal(HttpStatusCode.OK, await RoundCalls.SetAsync(world, round, filler.MemberId, going: true));
            fillers.Add(filler);
        }

        var racers = new List<(string Subject, Guid MemberId)>();
        for (var index = 0; index < Racers; index++)
        {
            racers.Add(await world.AddPersonAsync());
        }

        var raced = await N.RaceAsync(racers.Select(racer => (Func<Task<HttpStatusCode>>)(
            async () => (await RoundCalls.RespondAsync(world, racer.Subject, round, going: true)).Status)));
        Assert.All(raced, status => Assert.Equal(HttpStatusCode.OK, status));
        Assert.Equal(0, await N.OutboxOfRoundAsync(api.ConnectionString, round));
        var firstInLine = (await RoundCalls.RowsAsync(api.ConnectionString, round)).Where(row => row.Status == "waitlisted").OrderBy(row => row.Sequence).First().MemberId;

        Assert.Equal(HttpStatusCode.OK, (await RoundCalls.RespondAsync(world, fillers[0].Subject, round, going: false)).Status);

        Assert.Equal(1, await N.OutboxOfRoundAsync(api.ConnectionString, round));
        Assert.Equal(1, await N.NotificationsOfMemberAsync(api.ConnectionString, firstInLine));
        foreach (var racer in racers.Where(racer => racer.MemberId != firstInLine))
        {
            Assert.Equal(0, await N.NotificationsOfMemberAsync(api.ConnectionString, racer.MemberId));
        }
    }

    [Fact]
    public async Task I5_RaisingTheSpots_PromotesThroughTheOutbox()
    {
        var (world, client, round, waiting) = await WaitlistAsync();
        using (client)
        {
            using var response = await world.SendAsync(
                GroupActor.Admin, HttpMethod.Patch, RoundCalls.RoundPath(world, round), RaiseToTwo);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            await AssertToldOnceAsync(round, waiting);
        }
    }

    [Fact]
    public async Task I5_TheRepairOfARead_PromotesThroughTheOutbox()
    {
        var (world, client, round, waiting) = await WaitlistAsync();
        using (client)
        {
            // A spot freed without a write under the lock: the next read repairs the round.
            _ = await N.ExecuteAsync(
                api.ConnectionString,
                "DELETE FROM sessions.attendances WHERE round_id = @round AND member_id <> @waiting",
                ("round", Guid.Parse(round)), ("waiting", waiting));

            _ = await RoundCalls.GetAsync(world, round);

            await AssertToldOnceAsync(round, waiting);
        }
    }

    [Fact]
    public async Task I5_AMemberLeavingTheGroup_PromotesThroughTheOutbox()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var (round, going, waiting) = await N.RoundWithAWaitlistAsync(world);

        using var left = await world.SendAsAsync(going.Subject, HttpMethod.Post, world.GroupPath + "/leave");
        Assert.Equal(HttpStatusCode.NoContent, left.StatusCode);
        _ = await RoundCalls.GetAsync(world, round);

        await AssertToldOnceAsync(round, waiting.MemberId);
    }

    [Fact]
    public async Task I5_AnAnswerByTheRoundLink_PromotesThroughTheOutbox()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var (created, going, waiting) = await N.WaitlistRoundAsync(world);

        var (status, _) = await RoundLinkCalls.AnswerAsync(world, going.Subject, RoundLinkCalls.CodeOf(created), going: false);

        Assert.Equal(HttpStatusCode.OK, status);
        await AssertToldOnceAsync(created["roundId"]!.GetValue<string>(), waiting.MemberId);
    }

    [Fact]
    public async Task I9_AGuestWithoutAnAccount_AndAFormerMember_GetNothing()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var (round, going, _) = await N.RoundWithAWaitlistAsync(world);
        var guest = await GuestCalls.CreateAsync(world);
        Assert.Equal(HttpStatusCode.OK, await RoundCalls.SetAsync(world, round, guest, going: true));
        var former = world.MemberIds[GroupActor.LeftMember];

        // The one waiting goes first, then the guest: two "não vou" promote both.
        _ = await RoundCalls.RespondAsync(world, going.Subject, round, going: false);
        var first = (await RoundCalls.RowsAsync(api.ConnectionString, round)).Single(row => row.Status is "going" or "promoted" && row.MemberId != guest).MemberId;
        Assert.Equal(HttpStatusCode.OK, await RoundCalls.SetAsync(world, round, first, going: false));
        await N.RequestAsync(api, new NotificationRequest(
            $"test:{Guid.NewGuid():N}", NotificationRequestKind.WaitlistPromoted, former, world.GroupId, Guid.Parse(round), DateTimeOffset.UtcNow.AddDays(2)));

        Assert.Equal(2, await N.OutboxOfRoundAsync(api.ConnectionString, round));
        Assert.Equal(0, await N.NotificationsOfMemberAsync(api.ConnectionString, guest));
        Assert.Equal(0, await N.NotificationsOfMemberAsync(api.ConnectionString, former));
    }

    [Fact]
    public async Task AFormerMember_StillSeesTheNotification_WithoutTheVenue()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var (round, going, waiting) = await N.RoundWithAWaitlistAsync(world);
        _ = await RoundCalls.RespondAsync(world, going.Subject, round, going: false);
        var before = (await N.ListAsync(world, waiting.Subject))["items"]![0]!["subtitle"]!.GetValue<string>();

        using var left = await world.SendAsAsync(waiting.Subject, HttpMethod.Post, world.GroupPath + "/leave");
        var after = (await N.ListAsync(world, waiting.Subject))["items"]!.AsArray();

        Assert.Equal(HttpStatusCode.NoContent, left.StatusCode);
        Assert.EndsWith(" · Quadra 3", before, StringComparison.Ordinal);
        var item = Assert.Single(after)!;
        Assert.DoesNotContain("Quadra 3", item["subtitle"]!.GetValue<string>(), StringComparison.Ordinal);
        Assert.DoesNotContain("Quadra 3", item["title"]!.GetValue<string>(), StringComparison.Ordinal);
    }

    private async Task<(GroupWorld World, HttpClient Client, string Round, Guid Waiting)> WaitlistAsync()
    {
        var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var (round, _, waiting) = await N.RoundWithAWaitlistAsync(world);
        return (world, client, round, waiting.MemberId);
    }

    private async Task AssertToldOnceAsync(string round, Guid waiting)
    {
        Assert.Equal(1, await N.OutboxOfRoundAsync(api.ConnectionString, round));
        Assert.Equal(1, await N.NotificationsOfMemberAsync(api.ConnectionString, waiting));
    }

    private static string WeekLater(System.Text.Json.Nodes.JsonObject round) =>
        DateOnly.ParseExact(round["localDate"]!.GetValue<string>(), "yyyy-MM-dd", CultureInfo.InvariantCulture)
            .AddDays(DaysInWeek).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
}
