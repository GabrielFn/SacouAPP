using System.Net;
using Sacou.Integration.Tests.Sessions;
using Sacou.Modules.Notifications.Application;
using Sacou.Modules.Notifications.Contracts;
using Xunit;
using N = Sacou.Integration.Tests.Notifications.NotificationCalls;

namespace Sacou.Integration.Tests.Notifications;

/// <summary>The acceptance of E3.11: a promotion out of the waitlist makes one notification and one push per phone, once (I1 to I10, L1).</summary>
public sealed class PromotionNotificationTests : IAsyncLifetime
{
    private const string GroupName = "Areia de sábado";
    private const string Venue = "Quadra 3";

    private readonly RecordingPushGateway gateway = new();

    private readonly IntegrationDatabase database;

    private readonly ApiWithDatabase api;

    public PromotionNotificationTests(IntegrationDatabase database)
    {
        this.database = database;
        api = new ApiWithDatabase(database) { PushGateway = gateway };
    }

    private ApiWithDatabase Api => api;

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task I1_I3_NotGoing_PromotesOnce_OneOutboxRow_OneNotification_OnePush_EvenRepeated()
    {
        using var client = Api.CreateClient();
        var world = await Groups.GroupWorld.CreateAsync(Api, client, GroupName);
        var (round, going, waiting) = await N.RoundWithAWaitlistAsync(world);
        var token = N.Token();
        await N.RegisterAsync(world, waiting.Subject, Guid.NewGuid(), token);

        for (var repeat = 0; repeat < 3; repeat++)
        {
            Assert.Equal(HttpStatusCode.OK, (await RoundCalls.RespondAsync(world, going.Subject, round, going: false)).Status);
        }

        Assert.Equal(1, await N.OutboxOfRoundAsync(Api.ConnectionString, round));
        Assert.Equal(0, await N.CountAsync(Api.ConnectionString, "SELECT count(*) FROM sessions.outbox_messages WHERE payload->>'roundId' = @round AND processed_at IS NULL", ("round", round)));
        var sequence = (await RoundCalls.RowsAsync(Api.ConnectionString, round)).Single(row => row.MemberId == waiting.MemberId).Sequence;
        Assert.Equal(1, await N.CountAsync(Api.ConnectionString, "SELECT count(*) FROM sessions.outbox_messages WHERE dedupe_key = @key", ("key", $"sessions.waitlist-promoted:{round}:{waiting.MemberId}:{sequence}")));
        Assert.Equal(1, await N.NotificationsOfMemberAsync(Api.ConnectionString, waiting.MemberId));
        var push = Assert.Single(Sent());
        Assert.Equal(token, push.To);
        Assert.Equal("Você saiu da espera", push.Title);
        Assert.StartsWith($"Entrou no {GroupName} · ", push.Body, StringComparison.Ordinal);
        Assert.Equal(Guid.Parse(round), push.Data.RoundId);
        Assert.Equal("sent", await StateOfAsync(push.DeliveryId));
    }

    [Fact]
    public async Task I8_LeavingAndComingBack_IsASecondNotification()
    {
        using var client = Api.CreateClient();
        var world = await Groups.GroupWorld.CreateAsync(Api, client);
        var (round, first, second) = await N.RoundWithAWaitlistAsync(world);

        _ = await RoundCalls.RespondAsync(world, first.Subject, round, going: false);
        _ = await RoundCalls.RespondAsync(world, first.Subject, round, going: true);
        _ = await RoundCalls.RespondAsync(world, second.Subject, round, going: false);
        _ = await RoundCalls.RespondAsync(world, second.Subject, round, going: true);
        _ = await RoundCalls.RespondAsync(world, first.Subject, round, going: false);

        Assert.Equal(2, await N.NotificationsOfMemberAsync(Api.ConnectionString, second.MemberId));
        Assert.Equal(1, await N.NotificationsOfMemberAsync(Api.ConnectionString, first.MemberId));
        Assert.Equal(3, await N.OutboxOfRoundAsync(Api.ConnectionString, round));
    }

    [Fact]
    public async Task I5_AdminAnswer_PromotesThroughTheOutboxToo()
    {
        using var client = Api.CreateClient();
        var world = await Groups.GroupWorld.CreateAsync(Api, client);
        var (round, going, waiting) = await N.RoundWithAWaitlistAsync(world);

        Assert.Equal(HttpStatusCode.OK, await RoundCalls.SetAsync(world, round, going.MemberId, going: false));

        Assert.Equal(1, await N.OutboxOfRoundAsync(Api.ConnectionString, round));
        Assert.Equal(1, await N.NotificationsOfMemberAsync(Api.ConnectionString, waiting.MemberId));
    }

    [Fact]
    public async Task I6_TheSameRequestTwice_MakesOneNotification_AndOneDeliveryPerPhone()
    {
        using var client = Api.CreateClient();
        var world = await Groups.GroupWorld.CreateAsync(Api, client);
        var person = await world.AddPersonAsync();
        await N.RegisterAsync(world, person.Subject, Guid.NewGuid(), N.Token());
        var request = Request(world.GroupId, person.MemberId);

        await N.RequestAsync(Api, request);
        await N.RequestAsync(Api, request);

        Assert.Equal(1, await N.NotificationsOfMemberAsync(Api.ConnectionString, person.MemberId));
        Assert.Equal(1, await N.DeliveriesOfMemberAsync(Api.ConnectionString, person.MemberId));
    }

    [Fact]
    public async Task I9_NoAccountMakesNothing_NoPhoneMakesANotificationWithoutDelivery()
    {
        using var client = Api.CreateClient();
        var world = await Groups.GroupWorld.CreateAsync(Api, client);
        var stranger = Guid.NewGuid();
        var withoutPhone = await world.AddPersonAsync();

        await N.RequestAsync(Api, Request(world.GroupId, stranger));
        await N.RequestAsync(Api, Request(world.GroupId, withoutPhone.MemberId));

        Assert.Equal(0, await N.NotificationsOfMemberAsync(Api.ConnectionString, stranger));
        Assert.Equal(1, await N.NotificationsOfMemberAsync(Api.ConnectionString, withoutPhone.MemberId));
        Assert.Equal(0, await N.DeliveriesOfMemberAsync(Api.ConnectionString, withoutPhone.MemberId));
    }

    [Fact]
    public async Task I10_OnlyTheActivePhones_GetADelivery()
    {
        using var client = Api.CreateClient();
        var world = await Groups.GroupWorld.CreateAsync(Api, client);
        var person = await world.AddPersonAsync();
        var off = N.Token();
        foreach (var token in new[] { N.Token(), N.Token(), off })
        {
            await N.RegisterAsync(world, person.Subject, Guid.NewGuid(), token);
        }

        _ = await N.ExecuteAsync(
            Api.ConnectionString,
            "UPDATE notifications.push_devices SET disabled_at = now(), disabled_reason = 'not_registered' WHERE expo_token = @token",
            ("token", off));
        await N.RequestAsync(Api, Request(world.GroupId, person.MemberId));

        Assert.Equal(2, await N.DeliveriesOfMemberAsync(Api.ConnectionString, person.MemberId));
    }

    [Fact]
    public async Task I7_TwoPumpsAtOnce_NeverSendOneDeliveryTwice()
    {
        var slow = new RecordingPushGateway(TimeSpan.FromMilliseconds(200));
        await using var racing = new ApiWithDatabase(database) { PushGateway = slow };
        using var client = racing.CreateClient();
        var world = await Groups.GroupWorld.CreateAsync(racing, client);
        var person = await world.AddPersonAsync();
        var round = Guid.Parse((await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>());
        for (var phone = 0; phone < 3; phone++)
        {
            await N.RegisterAsync(world, person.Subject, Guid.NewGuid(), N.Token());
        }

        for (var notification = 0; notification < 4; notification++)
        {
            await N.RequestAsync(racing, Request(world.GroupId, person.MemberId, round));
        }

        await Task.WhenAll(N.PumpAsync(racing), N.PumpAsync(racing), N.PumpAsync(racing));

        Assert.Equal(12, await N.DeliveriesOfMemberAsync(racing.ConnectionString, person.MemberId));
        Assert.Equal(12, await N.CountAsync(
            racing.ConnectionString,
            "SELECT count(*) FROM notifications.push_deliveries d JOIN notifications.notifications n ON n.id = d.notification_id WHERE n.member_id = @member AND d.state = 'sent' AND d.attempts = 1",
            ("member", person.MemberId)));
        var mine = slow.Sent.Where(message => message.Data.GroupId == world.GroupId).ToList();
        Assert.Equal(12, mine.Count);
        Assert.Equal(12, mine.Select(message => message.DeliveryId).Distinct().Count());
    }

    [Fact]
    public async Task L1_TheLogsHaveNoToken_NoInstallation_NoGroupName_NoVenue()
    {
        using var client = Api.CreateClient();
        var world = await Groups.GroupWorld.CreateAsync(Api, client, GroupName);
        var (round, going, waiting) = await N.RoundWithAWaitlistAsync(world);
        var token = N.Token();
        var installation = Guid.NewGuid();
        await N.RegisterAsync(world, waiting.Subject, installation, token);

        _ = await RoundCalls.RespondAsync(world, going.Subject, round, going: false);
        _ = await N.ListAsync(world, waiting.Subject);

        var logs = string.Join('\n', Api.Logs.Entries);
        Assert.NotEmpty(Sent());
        Assert.DoesNotContain(token, logs, StringComparison.Ordinal);
        Assert.DoesNotContain(installation.ToString(), logs, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(GroupName, logs, StringComparison.Ordinal);
        Assert.DoesNotContain(Venue, logs, StringComparison.Ordinal);
    }

    private IReadOnlyList<PushMessage> Sent() => gateway.Sent;

    private Task<string?> StateOfAsync(Guid delivery) => N.StateAsync(Api.ConnectionString, delivery);

    private static NotificationRequest Request(Guid group, Guid member, Guid? round = null) =>
        new($"test:{Guid.NewGuid():N}", NotificationRequestKind.WaitlistPromoted, member, group, round ?? Guid.NewGuid(), DateTimeOffset.UtcNow.AddDays(2));
}
