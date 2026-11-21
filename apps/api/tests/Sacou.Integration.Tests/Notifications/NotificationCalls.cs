using System.Collections.Concurrent;
using System.Net;
using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Sessions;
using Sacou.Modules.Notifications.Application;
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

    /// <summary>Every ticket it gave was handed over.</summary>
    public Task<IReadOnlyList<PushReceipt>> GetReceiptsAsync(IReadOnlyList<string> ticketIds, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<PushReceipt>>([.. ticketIds.Select(ticket => new PushReceipt(ticket, PushReceiptKind.Delivered))]);
}

/// <summary>The routes of the Notifications and the rows behind them, for the integration tests of E3.11.</summary>
internal static class NotificationCalls
{
    public const string ListPath = "/v1/me/notifications";

    public const string DevicesPath = "/v1/me/push-devices";

    public const string RemovePath = "/v1/me/push-devices/remove";

    public static string Token() => $"ExponentPushToken[{Guid.NewGuid():N}]";

    public static string DeviceBody(Guid installationId, string token, string platform = "android") =>
        new JsonObject { ["installationId"] = installationId, ["token"] = token, ["platform"] = platform }.ToJsonString();

    public static string RemoveBody(Guid installationId) => new JsonObject { ["installationId"] = installationId }.ToJsonString();

    public static async Task RegisterAsync(GroupWorld world, string subject, Guid installationId, string token)
    {
        using var response = await world.SendAsAsync(subject, HttpMethod.Put, DevicesPath, DeviceBody(installationId, token));
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    public static async Task<JsonObject> ListAsync(GroupWorld world, string subject, string? cursor = null)
    {
        using var response = await world.SendAsAsync(subject, HttpMethod.Get, cursor is null ? ListPath : $"{ListPath}?cursor={Uri.EscapeDataString(cursor)}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await RoundCalls.JsonAsync(response);
    }

    /// <summary>The smallest limit of spots the settings catalog takes (<c>attendance.capacity</c>).</summary>
    public const int SmallestCapacity = 2;

    /// <summary>
    /// A round with room for two and a waitlist: a filler and the first person going, the second waiting. The first one's
    /// "não vou" promotes the second.
    /// </summary>
    public static async Task<(string Round, (string Subject, Guid MemberId) Going, (string Subject, Guid MemberId) Waiting)> RoundWithAWaitlistAsync(GroupWorld world)
    {
        var (created, going, waiting) = await WaitlistRoundAsync(world);
        return (created["roundId"]!.GetValue<string>(), going, waiting);
    }

    /// <summary>The same round, made from <paramref name="body"/>, with the whole answer of its creation (its link, its date).</summary>
    public static async Task<(JsonObject Created, (string Subject, Guid MemberId) Going, (string Subject, Guid MemberId) Waiting)> WaitlistRoundAsync(
        GroupWorld world, string? body = null)
    {
        await RoundCalls.ConfigureAttendanceAsync(world, capacity: SmallestCapacity);
        var created = await RoundCalls.CreateAsync(world, body);
        var round = created["roundId"]!.GetValue<string>();
        var filler = await world.AddPersonAsync();
        Assert.Equal(HttpStatusCode.OK, await RoundCalls.SetAsync(world, round, filler.MemberId, going: true));
        var going = await world.AddPersonAsync();
        var waiting = await world.AddPersonAsync();
        Assert.Equal("going", (await RoundCalls.RespondAsync(world, going.Subject, round, going: true)).Body!["status"]!.GetValue<string>());
        Assert.Equal("waitlisted", (await RoundCalls.RespondAsync(world, waiting.Subject, round, going: true)).Body!["status"]!.GetValue<string>());
        return (created, going, waiting);
    }

    /// <summary>The calls leave a barrier together, so their requests meet at the database.</summary>
    public static async Task<T[]> RaceAsync<T>(IEnumerable<Func<Task<T>>> calls)
    {
        var all = calls.ToList();
        using var gate = new Barrier(all.Count);
        return await Task.WhenAll(all.Select(async call =>
        {
            await Task.Yield();
            gate.SignalAndWait(TestContext.Current.CancellationToken);
            return await call();
        }));
    }

    /// <summary>An outbox row written straight to the table, as the round store writes it: its id.</summary>
    public static async Task<Guid> InsertOutboxAsync(
        string connectionString, string dedupeKey, Guid group, Guid round, Guid member, DateTimeOffset occurredAt)
    {
        var id = Guid.NewGuid();
        var payload = new JsonObject
        {
            ["roundId"] = round,
            ["groupId"] = group,
            ["memberId"] = member,
            ["sequence"] = 1,
            ["startsAt"] = DateTimeOffset.UtcNow.AddDays(2),
        }.ToJsonString();
        _ = await ExecuteAsync(
            connectionString,
            "INSERT INTO sessions.outbox_messages (id, dedupe_key, type, payload, occurred_at, attempts) VALUES (@id, @key, 'sessions.waitlist-promoted', @payload::jsonb, @at, 0)",
            ("id", id), ("key", dedupeKey), ("payload", payload), ("at", occurredAt));
        return id;
    }

    /// <summary>An outbox row's attempts, whether it was processed, and whether it was set aside (never both).</summary>
    public static async Task<(int Attempts, bool Processed, bool SetAside)> OutboxStateAsync(string connectionString, Guid id)
    {
        await using var connection = await MemberRows.OpenAsync(connectionString);
        await using var command = new NpgsqlCommand(
            "SELECT attempts, processed_at IS NOT NULL, set_aside_at IS NOT NULL FROM sessions.outbox_messages WHERE id = @id", connection);
        command.Parameters.AddWithValue("id", id);
        await using var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
        Assert.True(await reader.ReadAsync(TestContext.Current.CancellationToken));
        return (reader.GetInt32(0), reader.GetBoolean(1), reader.GetBoolean(2));
    }

    /// <summary>The outbox row of the promotion of <paramref name="member"/> in <paramref name="round"/> (the latest one).</summary>
    public static async Task<Guid> OutboxIdAsync(string connectionString, string round, Guid member)
    {
        await using var connection = await MemberRows.OpenAsync(connectionString);
        await using var command = new NpgsqlCommand(
            "SELECT id FROM sessions.outbox_messages WHERE payload->>'roundId' = @round AND payload->>'memberId' = @member ORDER BY occurred_at DESC LIMIT 1", connection);
        command.Parameters.AddWithValue("round", round);
        command.Parameters.AddWithValue("member", member.ToString());
        return (Guid)(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
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
