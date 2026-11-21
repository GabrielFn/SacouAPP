using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Sacou.Modules.Notifications.Application;
using Sacou.Modules.Notifications.Infrastructure.Expo;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Modules.Notifications.Tests;

/// <summary>E3, E8 and E13 of E3.11: the calls to Expo, the closed message, and the switch of the access token.</summary>
public sealed class ExpoPushGatewayTests : IDisposable
{
    private const string AccessToken = "expo-access-SECRET-value";
    private const string PushToken = "ExponentPushToken[SECRETPUSHTOKEN]";
    private const int MaxPushBytes = 4096;
    private const int LongestGroupName = 120;

    private readonly CollectingLoggerProvider logs = new();
    private readonly LoggerFactory loggers;

    public ExpoPushGatewayTests() => loggers = new LoggerFactory([logs]);

    [Fact]
    public async Task Send_PostsTheBatch_WithTheAccessToken_AndReadsTicketsInOrder()
    {
        string? authorization = null;
        string? body = null;
        using var stub = new StubHttpHandler(request =>
        {
            authorization = request.Headers.Authorization?.ToString();
            body = request.Content!.ReadAsStringAsync().GetAwaiter().GetResult();
            return StubHttpHandler.Json(
                """{"data":[{"status":"ok","id":"ticket-1"},{"status":"error","message":"\"ExponentPushToken[SECRETPUSHTOKEN]\" is not registered","details":{"error":"DeviceNotRegistered"}}]}""");
        });
        var (first, second) = (Message(), Message());

        var results = await Gateway(stub).SendAsync([first, second], TestContext.Current.CancellationToken);

        Assert.Equal(new Uri("https://exp.host/--/api/v2/push/send"), Assert.Single(stub.RequestedUris));
        Assert.Equal("Bearer " + AccessToken, authorization);
        using var sent = JsonDocument.Parse(body!);
        Assert.Equal(2, sent.RootElement.GetArrayLength());
        Assert.Equal((first.DeliveryId, PushResultKind.Accepted, "ticket-1"), (results[0].DeliveryId, results[0].Kind, results[0].TicketId));
        Assert.Equal((second.DeliveryId, PushResultKind.DeviceNotRegistered), (results[1].DeliveryId, results[1].Kind));
        AssertNoSecretLogged();
    }

    [Fact]
    public async Task E3_TimeoutAfterTheBodyWent_IsAmbiguous_AndNeverCalledAgain()
    {
        using var stub = new StubHttpHandler(_ => StubHttpHandler.Json("""{"data":[]}""")) { Delay = TimeSpan.FromSeconds(5) };
        var gateway = Gateway(stub, timeout: TimeSpan.FromMilliseconds(50));

        var results = await gateway.SendAsync([Message(), Message()], TestContext.Current.CancellationToken);

        Assert.All(results, result => Assert.Equal((PushResultKind.Ambiguous, ExpoOutcomes.Timeout), (result.Kind, result.Code)));
        Assert.Equal(1, stub.RequestCount);
        AssertNoSecretLogged();
    }

    [Theory]
    [InlineData(HttpStatusCode.TooManyRequests, nameof(PushResultKind.Retry))]
    [InlineData(HttpStatusCode.ServiceUnavailable, nameof(PushResultKind.Retry))]
    [InlineData(HttpStatusCode.Unauthorized, nameof(PushResultKind.Failed))]
    public async Task StatusWithoutTickets_GivesEveryMessageTheSameResult(HttpStatusCode status, string kind)
    {
        using var stub = new StubHttpHandler(_ => StubHttpHandler.Json("""{"errors":[{"code":"X","message":"ExponentPushToken[SECRETPUSHTOKEN]"}]}""", status: status));

        var results = await Gateway(stub).SendAsync([Message(), Message()], TestContext.Current.CancellationToken);

        Assert.All(results, result => Assert.Equal(Enum.Parse<PushResultKind>(kind), result.Kind));
        AssertNoSecretLogged();
    }

    [Fact]
    public async Task FewerTicketsThanMessages_LeavesTheRestAmbiguous()
    {
        using var stub = new StubHttpHandler(_ => StubHttpHandler.Json("""{"data":[{"status":"ok","id":"t1"}]}"""));

        var results = await Gateway(stub).SendAsync([Message(), Message()], TestContext.Current.CancellationToken);

        Assert.Equal([PushResultKind.Accepted, PushResultKind.Ambiguous], results.Select(result => result.Kind));
    }

    [Fact]
    public async Task Receipts_AreReadByTicket_AndAMissingOneIsLeftOut()
    {
        string? body = null;
        using var stub = new StubHttpHandler(request =>
        {
            body = request.Content!.ReadAsStringAsync().GetAwaiter().GetResult();
            return StubHttpHandler.Json("""{"data":{"a":{"status":"ok"},"b":{"status":"error","details":{"error":"DeviceNotRegistered"}}}}""");
        });

        var receipts = await Gateway(stub).GetReceiptsAsync(["a", "b", "c"], TestContext.Current.CancellationToken);

        Assert.Equal(new Uri("https://exp.host/--/api/v2/push/getReceipts"), Assert.Single(stub.RequestedUris));
        Assert.Equal("""{"ids":["a","b","c"]}""", body);
        Assert.Equal([("a", PushReceiptKind.Delivered), ("b", PushReceiptKind.DeviceNotRegistered)], receipts.Select(receipt => (receipt.TicketId, receipt.Kind)));
    }

    [Fact]
    public async Task ReceiptsOutOfReach_AreNone_ForNow()
    {
        using var stub = new StubHttpHandler(_ => throw new HttpRequestException(HttpRequestError.ConnectionError, "down"));

        Assert.Empty(await Gateway(stub).GetReceiptsAsync(["a"], TestContext.Current.CancellationToken));
    }

    [Fact]
    public void E8_TheMessage_IsClosed_AndFitsInFourKiB()
    {
        var message = Message(new string('G', LongestGroupName));

        var json = JsonSerializer.Serialize(ExpoPushGateway.ToExpo(message), ExpoJson.Options);
        using var document = JsonDocument.Parse(json);

        Assert.True(Encoding.UTF8.GetByteCount(json) < MaxPushBytes);
        Assert.Equal(
            ["to", "title", "body", "data", "channelId", "priority", "sound", "expiration"],
            document.RootElement.EnumerateObject().Select(property => property.Name));
        Assert.Equal(["kind", "notificationId", "groupId", "roundId"], document.RootElement.GetProperty("data").EnumerateObject().Select(property => property.Name));
        Assert.Equal("sacou-espera", document.RootElement.GetProperty("channelId").GetString());
        Assert.Equal("high", document.RootElement.GetProperty("priority").GetString());
        Assert.Equal(message.Expiration.ToUnixTimeSeconds(), document.RootElement.GetProperty("expiration").GetInt64());
        Assert.DoesNotContain("SECRET", ExpoPushGateway.ToExpo(message).ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public void E13_WithoutTheAccessToken_SendingIsOff_WithOneWarningAndNoValue()
    {
        var settings = Settings(token: null);

        Assert.False(settings.IsConfigured);
        Assert.False(settings.IsConfigured);
        var warning = Assert.Single(logs.Entries, entry => entry.Contains("Push sending is off", StringComparison.Ordinal));
        Assert.Contains(ExpoSettings.AccessTokenKey, warning, StringComparison.Ordinal);
        Assert.DoesNotContain("SECRET", settings.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public void WithTheAccessToken_SendingIsOn_AndItNeverPrints()
    {
        var settings = Settings(AccessToken);

        Assert.True(settings.IsConfigured);
        Assert.DoesNotContain(AccessToken, settings.ToString(), StringComparison.Ordinal);
        Assert.Empty(logs.Entries);
    }

    public void Dispose()
    {
        loggers.Dispose();
        logs.Dispose();
    }

    private static PushMessage Message(string group = "Areia") => new(
        Guid.NewGuid(),
        PushToken,
        NotificationTexts.PushTitle,
        NotificationTexts.PushBody(group, new DateOnly(2026, 11, 21), new TimeOnly(19, 30)),
        new PushData(PushMessages.WaitlistPromotedKind, Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid()),
        new DateTimeOffset(2026, 11, 21, 22, 30, 0, TimeSpan.Zero));

    private ExpoSettings Settings(string? token) => new(
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { [ExpoSettings.AccessTokenKey] = token }).Build(),
        loggers.CreateLogger<ExpoSettings>());

    private ExpoPushGateway Gateway(StubHttpHandler stub, TimeSpan? timeout = null) =>
        new(new HttpClient(stub, disposeHandler: false) { Timeout = timeout ?? ExpoPushGateway.Timeout }, Settings(AccessToken), loggers.CreateLogger<ExpoPushGateway>());

    private void AssertNoSecretLogged() => Assert.DoesNotContain("SECRET", string.Join('\n', logs.Entries), StringComparison.Ordinal);
}
