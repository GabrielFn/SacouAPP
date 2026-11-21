using Microsoft.Extensions.DependencyInjection;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Sessions;
using Sacou.Modules.Notifications.Application;
using Sacou.Modules.Notifications.Contracts;
using Sacou.Modules.Notifications.Infrastructure;
using Xunit;
using N = Sacou.Integration.Tests.Notifications.NotificationCalls;

namespace Sacou.Integration.Tests.Notifications;

/// <summary>
/// Part 2 of E3.11 on a real database: the check at the send, the receipts, the lease and the expiry (E4, E5, E7), and the
/// cleanup of the module and of the outbox.
/// </summary>
public sealed class PushSendTests : IAsyncLifetime
{
    private readonly RecordingPushGateway gateway = new();
    private readonly ApiWithDatabase api;

    public PushSendTests(IntegrationDatabase database) => api = new ApiWithDatabase(database) { PushGateway = gateway };

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task APhoneMovedToAnotherAccount_BeforeTheSend_FailsUnsent()
    {
        var (_, delivery, _) = await PendingDeliveryAsync();
        _ = await N.ExecuteAsync(
            api.ConnectionString,
            "UPDATE notifications.push_devices SET user_id = @other WHERE id = (SELECT device_id FROM notifications.push_deliveries WHERE id = @id)",
            ("other", Guid.NewGuid()),
            ("id", delivery));

        await N.PumpAsync(api);

        Assert.DoesNotContain(gateway.Sent, message => message.DeliveryId == delivery);
        Assert.Equal("failed", await N.StateAsync(api.ConnectionString, delivery));
        Assert.Equal(PushMessages.RecipientGone, await ErrorOfAsync(delivery));
    }

    [Fact]
    public async Task E7_TheReceipt_IsReadWhenDue_AndTheDeliveryIsDelivered()
    {
        var (_, delivery, _) = await PendingDeliveryAsync();
        await N.PumpAsync(api);
        Assert.Equal("sent", await N.StateAsync(api.ConnectionString, delivery));

        await N.PumpAsync(api);
        Assert.Equal("sent", await N.StateAsync(api.ConnectionString, delivery));
        _ = await N.ExecuteAsync(api.ConnectionString, "UPDATE notifications.push_deliveries SET next_attempt_at = now() - interval '1 minute' WHERE id = @id", ("id", delivery));
        await N.PumpAsync(api);

        Assert.Equal("delivered", await N.StateAsync(api.ConnectionString, delivery));
    }

    [Fact]
    public async Task E4_E5_ALeaseRunOut_IsUnknown_AndARoundStarted_IsExpired_NeitherSent()
    {
        var (_, leased, _) = await PendingDeliveryAsync();
        _ = await N.ExecuteAsync(
            api.ConnectionString, "UPDATE notifications.push_deliveries SET state = 'sending', lease_until = now() - interval '1 second' WHERE id = @id", ("id", leased));
        var (_, late, _) = await PendingDeliveryAsync();
        _ = await N.ExecuteAsync(
            api.ConnectionString,
            "UPDATE notifications.notifications SET expires_at = now() - interval '1 second' WHERE id = (SELECT notification_id FROM notifications.push_deliveries WHERE id = @id)",
            ("id", late));

        await N.PumpAsync(api);

        Assert.DoesNotContain(gateway.Sent, message => message.DeliveryId == leased || message.DeliveryId == late);
        Assert.Equal("unknown", await N.StateAsync(api.ConnectionString, leased));
        Assert.Equal("expired", await N.StateAsync(api.ConnectionString, late));
    }

    [Fact]
    public async Task TheCleanup_DeletesOnlyWhatIsOldEnough()
    {
        var (notification, delivery, member) = await PendingDeliveryAsync();
        var (keptNotification, kept, _) = await PendingDeliveryAsync();
        _ = await N.ExecuteAsync(
            api.ConnectionString, "UPDATE notifications.push_deliveries SET state = 'failed', updated_at = now() - interval '8 days' WHERE id = @id", ("id", delivery));
        _ = await N.ExecuteAsync(api.ConnectionString, "UPDATE notifications.notifications SET created_at = now() - interval '31 days' WHERE id = @id", ("id", notification));
        var round = Guid.NewGuid();
        var processed = await N.InsertOutboxAsync(api.ConnectionString, $"test:{Guid.NewGuid():N}", Guid.NewGuid(), round, member, DateTimeOffset.UtcNow);
        var recent = await N.InsertOutboxAsync(api.ConnectionString, $"test:{Guid.NewGuid():N}", Guid.NewGuid(), round, member, DateTimeOffset.UtcNow);
        _ = await N.ExecuteAsync(api.ConnectionString, "UPDATE sessions.outbox_messages SET processed_at = now() - interval '8 days' WHERE id = @id", ("id", processed));
        _ = await N.ExecuteAsync(api.ConnectionString, "UPDATE sessions.outbox_messages SET processed_at = now() WHERE id = @id", ("id", recent));

        await CleanUpAsync();

        Assert.Null(await N.StateAsync(api.ConnectionString, delivery));
        Assert.Equal(0, await N.CountAsync(api.ConnectionString, "SELECT count(*) FROM notifications.notifications WHERE id = @id", ("id", notification)));
        Assert.Equal("pending", await N.StateAsync(api.ConnectionString, kept));
        Assert.Equal(1, await N.CountAsync(api.ConnectionString, "SELECT count(*) FROM notifications.notifications WHERE id = @id", ("id", keptNotification)));
        Assert.Equal(0, await N.CountAsync(api.ConnectionString, "SELECT count(*) FROM sessions.outbox_messages WHERE id = @id", ("id", processed)));
        Assert.Equal(1, await N.CountAsync(api.ConnectionString, "SELECT count(*) FROM sessions.outbox_messages WHERE id = @id", ("id", recent)));
    }

    /// <summary>A member with one phone and one pending delivery for a real round: the notification, the delivery and the member.</summary>
    private async Task<(Guid Notification, Guid Delivery, Guid Member)> PendingDeliveryAsync()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = Guid.Parse((await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>());
        var person = await world.AddPersonAsync();
        await N.RegisterAsync(world, person.Subject, Guid.NewGuid(), N.Token());
        await N.RequestAsync(api, new NotificationRequest(
            $"test:{Guid.NewGuid():N}", NotificationRequestKind.WaitlistPromoted, person.MemberId, world.GroupId, round, DateTimeOffset.UtcNow.AddDays(2)));
        var notification = await IdAsync("SELECT id FROM notifications.notifications WHERE member_id = @member", person.MemberId);
        var delivery = await IdAsync("SELECT id FROM notifications.push_deliveries WHERE notification_id = @member", notification);
        return (notification, delivery, person.MemberId);
    }

    private async Task<Guid> IdAsync(string sql, Guid parameter)
    {
        await using var connection = await MemberRows.OpenAsync(api.ConnectionString);
        await using var command = new Npgsql.NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("member", parameter);
        return (Guid)(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
    }

    private async Task<string?> ErrorOfAsync(Guid delivery)
    {
        await using var connection = await MemberRows.OpenAsync(api.ConnectionString);
        await using var command = new Npgsql.NpgsqlCommand("SELECT error_code FROM notifications.push_deliveries WHERE id = @id", connection);
        command.Parameters.AddWithValue("id", delivery);
        return (string?)await command.ExecuteScalarAsync(TestContext.Current.CancellationToken);
    }

    private async Task CleanUpAsync()
    {
        var scope = api.Services.CreateAsyncScope();
        await using (scope.ConfigureAwait(false))
        {
            await scope.ServiceProvider.GetRequiredService<INotificationRetention>().CleanUpAsync(DateTimeOffset.UtcNow, TestContext.Current.CancellationToken);
            foreach (var source in scope.ServiceProvider.GetServices<INotificationSource>())
            {
                await source.CleanUpAsync(DateTimeOffset.UtcNow, TestContext.Current.CancellationToken);
            }
        }
    }
}
