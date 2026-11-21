using System.Net;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Sacou.Modules.Notifications.Application;
using Sacou.Modules.Notifications.Domain;
using Sacou.Modules.Notifications.Infrastructure.Expo;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Modules.Notifications.Tests;

/// <summary>
/// Extra tests of E3.11 part 2: the table of plan 3.1 end to end (the real Expo gateway on a stub, the real pump on a
/// store in memory), the edges of the receipts, what the logs never hold, and the sending switched off.
/// </summary>
public sealed class PushPumpHardeningTests : IDisposable
{
    private const string AccessToken = "expo-access-SECRET-value";
    private const string PushTokenMarker = "ExponentPushToken";
    private const string TicketBody = """{"data":[{"status":"error","message":"\"ExponentPushToken[x]\" free text SECRET","details":{"error":"__CODE__"}}]}""";

    private static readonly DateTimeOffset Start = new(2026, 11, 20, 12, 0, 0, TimeSpan.Zero);

    private readonly FixedTimeProvider clock = new(Start);
    private readonly InMemoryDeliveryStore store = new();
    private readonly RecordingScheduler scheduler = new();
    private readonly CollectingLoggerProvider logs = new();
    private readonly LoggerFactory loggers;
    private readonly FakeMemberAccounts accounts;

    public PushPumpHardeningTests()
    {
        loggers = new LoggerFactory([logs]);
        accounts = new FakeMemberAccounts(store);
    }

    [Theory]
    [InlineData("DeviceNotRegistered", nameof(DeliveryState.Failed), true, false)]
    [InlineData("MessageRateExceeded", nameof(DeliveryState.Pending), false, true)]
    [InlineData("MessageTooBig", nameof(DeliveryState.Failed), false, false)]
    [InlineData("InvalidCredentials", nameof(DeliveryState.Failed), false, false)]
    [InlineData("MismatchSenderId", nameof(DeliveryState.Failed), false, false)]
    public async Task Table31_ErrorTicket_EndToEnd(string code, string state, bool deviceOff, bool retries)
    {
        var delivery = store.Add(Start);
        using var expo = new StubHttpHandler(_ => StubHttpHandler.Json(TicketBody.Replace("__CODE__", code, StringComparison.Ordinal)));

        await Pump(Gateway(expo)).RunAsync(TestContext.Current.CancellationToken);

        Assert.Equal((Enum.Parse<DeliveryState>(state), deviceOff, code), (delivery.State, delivery.DeviceDisabled, delivery.ErrorCode));
        Assert.Equal(retries, delivery.NextAttemptAt > Start);
        Assert.Equal(1, expo.RequestCount);
    }

    [Fact]
    public async Task Table31_OkTicket_IsSent_WithTheReceiptDueIn15Minutes()
    {
        var delivery = store.Add(Start);
        using var expo = new StubHttpHandler(_ => StubHttpHandler.Json("""{"data":[{"status":"ok","id":"ticket-9"}]}"""));

        await Pump(Gateway(expo)).RunAsync(TestContext.Current.CancellationToken);

        Assert.Equal((DeliveryState.Sent, "ticket-9", Start + NotificationLimits.ReceiptDelay), (delivery.State, delivery.TicketId, delivery.NextAttemptAt));
    }

    [Fact]
    public async Task Table31_5xx_RetriesWithoutTickets_ThenGivesUpAfterTheLastAttempt()
    {
        var delivery = store.Add(Start);
        using var expo = new StubHttpHandler(_ => StubHttpHandler.Json("{}", status: HttpStatusCode.BadGateway));
        var pump = Pump(Gateway(expo));

        for (var attempt = 1; attempt <= DeliveryRules.MaxAttempts; attempt++)
        {
            Assert.Equal(DeliveryState.Pending, delivery.State);
            clock.Advance(TimeSpan.FromHours(1));
            await pump.RunAsync(TestContext.Current.CancellationToken);
            Assert.Equal(attempt, delivery.Attempts);
        }

        Assert.Equal(DeliveryState.Failed, delivery.State);
        Assert.Equal(DeliveryRules.MaxAttempts, expo.RequestCount);
    }

    [Fact]
    public async Task Table31_Timeout_IsUnknown_AndNeverSentAgain()
    {
        var delivery = store.Add(Start);
        using var expo = new StubHttpHandler(_ => StubHttpHandler.Json("{}")) { Delay = TimeSpan.FromSeconds(5) };
        var pump = Pump(Gateway(expo, TimeSpan.FromMilliseconds(30)));

        await pump.RunAsync(TestContext.Current.CancellationToken);
        clock.Advance(TimeSpan.FromHours(3));
        await pump.RunAsync(TestContext.Current.CancellationToken);

        Assert.Equal(DeliveryState.Unknown, delivery.State);
        Assert.Equal(1, expo.RequestCount);
    }

    [Fact]
    public async Task Table31_4xx_FailsAtOnce_WithoutRetry()
    {
        var delivery = store.Add(Start);
        using var expo = new StubHttpHandler(_ => StubHttpHandler.Json("{}", status: HttpStatusCode.BadRequest));
        var pump = Pump(Gateway(expo));

        await pump.RunAsync(TestContext.Current.CancellationToken);
        clock.Advance(TimeSpan.FromHours(3));
        await pump.RunAsync(TestContext.Current.CancellationToken);

        Assert.Equal((DeliveryState.Failed, "http-400", 1), (delivery.State, delivery.ErrorCode, expo.RequestCount));
    }

    [Fact]
    public async Task ReceiptMessageRateExceeded_FailsTheDelivery_AndIsNeverSentAgain()
    {
        var delivery = store.Add(Start);
        var scripted = new ScriptedPushGateway();
        await Pump(scripted).RunAsync(TestContext.Current.CancellationToken);
        scripted.Receipts = tickets => [.. tickets.Select(ticket => new PushReceipt(ticket, PushReceiptKind.Failed, "MessageRateExceeded"))];

        clock.Advance(NotificationLimits.ReceiptDelay);
        await Pump(scripted).RunAsync(TestContext.Current.CancellationToken);
        clock.Advance(TimeSpan.FromHours(2));
        await Pump(scripted).RunAsync(TestContext.Current.CancellationToken);

        Assert.Equal((DeliveryState.Failed, "MessageRateExceeded", false), (delivery.State, delivery.ErrorCode, delivery.DeviceDisabled));
        Assert.Single(scripted.Batches);
    }

    [Fact]
    public async Task ReceiptMissing_JustBeforeADay_StillWaits_AtADay_IsUnknown()
    {
        var delivery = store.Add(Start);
        var scripted = new ScriptedPushGateway();
        await Pump(scripted).RunAsync(TestContext.Current.CancellationToken);

        clock.Advance(NotificationLimits.ReceiptGiveUp - TimeSpan.FromSeconds(1));
        delivery.NextAttemptAt = clock.GetUtcNow();
        await Pump(scripted).RunAsync(TestContext.Current.CancellationToken);
        Assert.Equal(DeliveryState.Sent, delivery.State);

        clock.Advance(TimeSpan.FromSeconds(1));
        delivery.NextAttemptAt = clock.GetUtcNow();
        await Pump(scripted).RunAsync(TestContext.Current.CancellationToken);
        Assert.Equal((DeliveryState.Unknown, ReceiptOutcomes.ReceiptMissing), (delivery.State, delivery.ErrorCode));
        Assert.Single(scripted.Batches);
    }

    [Fact]
    public async Task NoLog_HoldsThePushToken_TheAccessToken_OrExpoFreeText()
    {
        store.Add(Start);
        store.Add(Start);
        store.Add(Start);
        var answers = new Queue<HttpResponseMessage>(
        [
            StubHttpHandler.Json("""{"data":[{"status":"error","message":"ExponentPushToken[x] SECRET","details":{"error":"InvalidCredentials"}},{"status":"ok","id":"t2"},{"status":"error","details":{"error":"DeviceNotRegistered"}}]}"""),
            StubHttpHandler.Json("""{"data":{"t2":{"status":"error","message":"ExponentPushToken[x] SECRET","details":{"error":"InvalidCredentials"}}}}"""),
        ]);
        using var expo = new StubHttpHandler(_ => answers.Dequeue());
        var pump = Pump(Gateway(expo));

        await pump.RunAsync(TestContext.Current.CancellationToken);
        clock.Advance(NotificationLimits.ReceiptDelay);
        await pump.RunAsync(TestContext.Current.CancellationToken);

        var all = string.Join('\n', logs.Entries);
        Assert.NotEmpty(logs.Entries);
        Assert.DoesNotContain(PushTokenMarker, all, StringComparison.Ordinal);
        Assert.DoesNotContain("SECRET", all, StringComparison.Ordinal);
        Assert.DoesNotContain(AccessToken, all, StringComparison.Ordinal);
    }

    [Fact]
    public async Task WithoutTheAccessToken_NothingIsSent_NoCallIsMade_AndTheDeliveryWaits()
    {
        var delivery = store.Add(Start);
        using var expo = new StubHttpHandler(_ => StubHttpHandler.Json("{}"));

        await Pump(Gateway(expo, token: null)).RunAsync(TestContext.Current.CancellationToken);

        Assert.Equal(0, expo.RequestCount);
        Assert.Equal((DeliveryState.Pending, 0), (delivery.State, delivery.Attempts));
        Assert.Empty(scheduler.Asked);
        Assert.DoesNotContain(AccessToken, string.Join('\n', logs.Entries), StringComparison.Ordinal);
    }

    [Fact]
    public async Task AnUnexpectedExceptionOfTheGateway_NeverLeavesTheBatchSending()
    {
        var delivery = store.Add(Start);
        var scripted = new ScriptedPushGateway { DuringSend = () => throw new NotSupportedException("boom SECRET") };

        var escaped = await Record.ExceptionAsync(() => Pump(scripted).RunAsync(TestContext.Current.CancellationToken));
        clock.Advance(TimeSpan.FromHours(3));
        await Pump(scripted).RunAsync(TestContext.Current.CancellationToken);

        Assert.Null(escaped);
        Assert.Equal((DeliveryState.Unknown, PushOutcomes.UnexpectedFailure), (delivery.State, delivery.ErrorCode));
        Assert.Single(scripted.Batches);
        var all = string.Join('\n', logs.Entries);
        Assert.Contains(nameof(NotSupportedException), all, StringComparison.Ordinal);
        Assert.DoesNotContain("SECRET", all, StringComparison.Ordinal);
    }

    [Fact]
    public async Task AnUnexpectedExceptionOfTheReceiptsRead_KeepsTheDeliverySent_AndReadsAgainLater()
    {
        var delivery = store.Add(Start);
        var scripted = new ScriptedPushGateway();
        await Pump(scripted).RunAsync(TestContext.Current.CancellationToken);
        scripted.Receipts = _ => throw new NotSupportedException("boom SECRET");

        clock.Advance(NotificationLimits.ReceiptDelay);
        var escaped = await Record.ExceptionAsync(() => Pump(scripted).RunAsync(TestContext.Current.CancellationToken));

        Assert.Null(escaped);
        Assert.Equal(DeliveryState.Sent, delivery.State);
        Assert.DoesNotContain("SECRET", string.Join('\n', logs.Entries), StringComparison.Ordinal);
    }

    public void Dispose()
    {
        loggers.Dispose();
        logs.Dispose();
    }

    private ExpoPushGateway Gateway(StubHttpHandler expo, TimeSpan? timeout = null, string? token = AccessToken) => new(
        new HttpClient(expo, disposeHandler: false) { Timeout = timeout ?? ExpoPushGateway.Timeout },
        new ExpoSettings(
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { [ExpoSettings.AccessTokenKey] = token }).Build(),
            loggers.CreateLogger<ExpoSettings>()),
        loggers.CreateLogger<ExpoPushGateway>());

    private PushPump Pump(IPushGateway gateway) => new(
        store,
        gateway,
        new PushMessages(new FakeGroupDirectory(), new FakeNotificationRounds(), accounts),
        scheduler,
        clock,
        loggers.CreateLogger<PushPump>());
}
