using System.Collections.Concurrent;
using System.Net;
using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Sessions;
using Sacou.Modules.Notifications.Contracts;
using Xunit;

namespace Sacou.Integration.Tests.Notifications;

/// <summary>A push service that takes every message, counts each delivery it saw, and can wait a moment to widen a race.</summary>
internal sealed class RecordingPushGateway(TimeSpan delay = default) : IPushGateway
{
    private readonly ConcurrentQueue<PushMessage> sent = new();

    public bool IsEnabled => true;

    public IReadOnlyList<PushMessage> Sent => [.. sent];

    public async Task<IReadOnlyList<PushResult>> SendAsync(IReadOnlyList<PushMessage> messages, CancellationToken cancellationToken)
    {
        if (delay > TimeSpan.Zero)
        {
            await Task.Delay(delay, CancellationToken.None);
        }

        foreach (var message in messages)
        {
            sent.Enqueue(message);
        }

        return [.. messages.Select(message => new PushResult(message.DeliveryId, PushResultKind.Accepted, TicketId: "ticket-" + message.DeliveryId))];
    }
}

/// <summary>The routes of the Notifications and the rows behind them, for the integration tests of E3.11.</summary>
internal static class NotificationCalls
{
    public const string ListPath = "/v1/me/notifications";

    public static string DevicePath(Guid installationId) => $"/v1/me/push-devices/{installationId}";

    public static string Token() => $"ExponentPushToken[{Guid.NewGuid():N}]";

    public static string DeviceBody(string token, string platform = "android") =>
        new JsonObject { ["token"] = token, ["platform"] = platform }.ToJsonString();

    public static async Task RegisterAsync(GroupWorld world, string subject, Guid installationId, string token)
    {
        using var response = await world.SendAsAsync(subject, HttpMethod.Put, DevicePath(installationId), DeviceBody(token));
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    public static async Task<JsonObject> ListAsync(GroupWorld world, string subject, string? cursor = null)
    {
        using var response = await world.SendAsAsync(subject, HttpMethod.Get, cursor is null ? ListPath : $"{ListPath}?cursor={Uri.EscapeDataString(cursor)}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await RoundCalls.JsonAsync(response);
    }

    /// <summary>
    /// A round with room for one and a waitlist, the first person going and the second waiting: the first one's "não vou"
    /// promotes the second.
    /// </summary>
    public static async Task<(string Round, (string Subject, Guid MemberId) Going, (string Subject, Guid MemberId) Waiting)> RoundWithAWaitlistAsync(GroupWorld world)
    {
        await RoundCalls.ConfigureAttendanceAsync(world, capacity: 1);
        var round = (await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>();
        var going = await world.AddPersonAsync();
        var waiting = await world.AddPersonAsync();
        Assert.Equal("going", (await RoundCalls.RespondAsync(world, going.Subject, round, going: true)).Body!["status"]!.GetValue<string>());
        Assert.Equal("waitlisted", (await RoundCalls.RespondAsync(world, waiting.Subject, round, going: true)).Body!["status"]!.GetValue<string>());
        return (round, going, waiting);
    }

    /// <summary>Asks for a notification straight through the contract, as the relay does.</summary>
    public static async Task RequestAsync(ApiWithDatabase api, NotificationRequest request)
    {
        var scope = api.Services.CreateAsyncScope();
        await using (scope.ConfigureAwait(false))
        {
            await scope.ServiceProvider.GetRequiredService<INotificationRequests>().RequestAsync(request, TestContext.Current.CancellationToken);
        }
    }

    public static async Task PumpAsync(ApiWithDatabase api)
    {
        var scope = api.Services.CreateAsyncScope();
        await using (scope.ConfigureAwait(false))
        {
            await scope.ServiceProvider.GetRequiredService<INotificationPump>().RunAsync(TestContext.Current.CancellationToken);
        }
    }

    public static async Task<long> CountAsync(string connectionString, string sql, params (string Name, object Value)[] parameters)
    {
        await using var connection = await MemberRows.OpenAsync(connectionString);
        await using var command = new NpgsqlCommand(sql, connection);
        foreach (var (name, value) in parameters)
        {
            command.Parameters.AddWithValue(name, value);
        }

        return Convert.ToInt64(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken), System.Globalization.CultureInfo.InvariantCulture);
    }

    public static async Task<string?> StateAsync(string connectionString, Guid delivery)
    {
        await using var connection = await MemberRows.OpenAsync(connectionString);
        await using var command = new NpgsqlCommand("SELECT state FROM notifications.push_deliveries WHERE id = @id", connection);
        command.Parameters.AddWithValue("id", delivery);
        return (string?)await command.ExecuteScalarAsync(TestContext.Current.CancellationToken);
    }

    public static Task<long> OutboxOfRoundAsync(string connectionString, string round) =>
        CountAsync(connectionString, "SELECT count(*) FROM sessions.outbox_messages WHERE payload->>'roundId' = @round", ("round", round));

    public static Task<long> NotificationsOfMemberAsync(string connectionString, Guid member) =>
        CountAsync(connectionString, "SELECT count(*) FROM notifications.notifications WHERE member_id = @member", ("member", member));

    public static Task<long> DeliveriesOfMemberAsync(string connectionString, Guid member) =>
        CountAsync(
            connectionString,
            "SELECT count(*) FROM notifications.push_deliveries d JOIN notifications.notifications n ON n.id = d.notification_id WHERE n.member_id = @member",
            ("member", member));

    public static async Task<int> ExecuteAsync(string connectionString, string sql, params (string Name, object Value)[] parameters)
    {
        await using var connection = await MemberRows.OpenAsync(connectionString);
        await using var command = new NpgsqlCommand(sql, connection);
        foreach (var (name, value) in parameters)
        {
            command.Parameters.AddWithValue(name, value);
        }

        return await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }
}
