using Microsoft.Extensions.Logging.Abstractions;
using Sacou.Modules.Notifications.Application;
using Sacou.Modules.Notifications.Domain;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Modules.Notifications.Tests;

/// <summary>E2, E6, E7 and E12 of E3.11, and the check at the send (condition of part 2), with a store in memory and a fake clock.</summary>
public sealed class PushPumpTests
{
    private const int ManyDeliveries = 250;

    private static readonly DateTimeOffset Start = new(2026, 11, 20, 12, 0, 0, TimeSpan.Zero);

    private readonly FixedTimeProvider clock = new(Start);
    private readonly InMemoryDeliveryStore store = new();
    private readonly ScriptedPushGateway gateway = new();
    private readonly RecordingScheduler scheduler = new();
    private readonly FakeMemberAccounts accounts;

    public PushPumpTests() => accounts = new FakeMemberAccounts(store);

    [Fact]
    public async Task E2_RateLimitedTwice_ThenTaken_TriesThreeTimes_After30SecondsAnd2Minutes()
    {
        var delivery = store.Add(Start);
        gateway.Answers.Enqueue(ScriptedPushGateway.RateLimited);
        gateway.Answers.Enqueue(ScriptedPushGateway.RateLimited);
        gateway.Answers.Enqueue(ScriptedPushGateway.Accept);

        await RunAsync();
        Assert.Equal((DeliveryState.Pending, Start.AddSeconds(30)), (delivery.State, delivery.NextAttemptAt));
        clock.Advance(TimeSpan.FromSeconds(29));
        await RunAsync();
        Assert.Single(gateway.Batches);
        clock.Advance(TimeSpan.FromSeconds(1));
        await RunAsync();
        Assert.Equal(clock.GetUtcNow().AddMinutes(2), delivery.NextAttemptAt);
        clock.Advance(TimeSpan.FromMinutes(2));
        await RunAsync();

        Assert.Equal(3, gateway.Batches.Count);
        Assert.Equal((DeliveryState.Sent, 3), (delivery.State, delivery.Attempts));
        Assert.NotNull(delivery.TicketId);
        // Each run asks for a call when the next thing is due: the tries, then the receipt.
        Assert.Equal(Start.AddSeconds(30), scheduler.Asked[0]);
        Assert.Equal(clock.GetUtcNow() + NotificationLimits.ReceiptDelay, scheduler.Asked[^1]);
    }

    [Fact]
    public async Task E6_250Deliveries_GoInThreeCalls()
    {
        for (var index = 0; index < ManyDeliveries; index++)
        {
            store.Add(Start);
        }

        await RunAsync();

        Assert.Equal([100, 100, 50], gateway.Batches);
        Assert.All(store.Rows, row => Assert.Equal(DeliveryState.Sent, row.State));
    }

    [Fact]
    public async Task E12_ABudgetSpentDuringASend_FinishesThatBatch_AndLeavesTheRestPending()
    {
        for (var index = 0; index < ManyDeliveries; index++)
        {
            store.Add(Start);
        }

        using var budget = new CancellationTokenSource();
        gateway.DuringSend = budget.Cancel;

        await Pump().RunAsync(budget.Token);

        Assert.Equal([100], gateway.Batches);
        Assert.Equal(100, store.Rows.Count(row => row.State == DeliveryState.Sent));
        Assert.Equal(ManyDeliveries - 100, store.Rows.Count(row => row.State == DeliveryState.Pending));
        Assert.NotEmpty(scheduler.Asked);
    }

    [Fact]
    public async Task AMemberWhoLeft_OrAPhoneOfAnotherAccount_FailsUnsent()
    {
        var left = store.Add(Start);
        var moved = store.Add(Start);
        var kept = store.Add(Start);
        accounts.Overrides[left.MemberId] = null;
        accounts.Overrides[moved.MemberId] = Guid.NewGuid();

        await RunAsync();

        Assert.Equal([1], gateway.Batches);
        Assert.Equal((DeliveryState.Failed, PushMessages.RecipientGone), (left.State, left.ErrorCode));
        Assert.Equal((DeliveryState.Failed, PushMessages.RecipientGone), (moved.State, moved.ErrorCode));
        Assert.Equal(DeliveryState.Sent, kept.State);
    }

    [Fact]
    public async Task E7_Receipts_DeliveredTurnedOffAndUnknownAfterADay()
    {
        var delivered = store.Add(Start);
        var gone = store.Add(Start);
        var silent = store.Add(Start);
        await RunAsync();
        gateway.Receipts = tickets =>
        [
            .. tickets.Where(ticket => ticket == delivered.TicketId).Select(ticket => new PushReceipt(ticket, PushReceiptKind.Delivered)),
            .. tickets.Where(ticket => ticket == gone.TicketId).Select(ticket => new PushReceipt(ticket, PushReceiptKind.DeviceNotRegistered, "DeviceNotRegistered")),
        ];

        clock.Advance(NotificationLimits.ReceiptDelay);
        await RunAsync();
        Assert.Equal(DeliveryState.Delivered, delivered.State);
        Assert.Equal(DeliveryState.Failed, gone.State);
        Assert.True(gone.DeviceDisabled);
        Assert.Equal(DeliveryState.Sent, silent.State);

        clock.Advance(NotificationLimits.ReceiptGiveUp);
        await RunAsync();
        Assert.Equal((DeliveryState.Unknown, ReceiptOutcomes.ReceiptMissing), (silent.State, silent.ErrorCode));
    }

    [Fact]
    public async Task WithSendingOff_NothingIsClaimedNorScheduled()
    {
        var delivery = store.Add(Start);

        await Pump(new ScriptedPushGateway { IsEnabled = false }).RunAsync(TestContext.Current.CancellationToken);

        Assert.Equal((DeliveryState.Pending, 0), (delivery.State, delivery.Attempts));
        Assert.Empty(scheduler.Asked);
    }

    private Task RunAsync() => Pump().RunAsync(TestContext.Current.CancellationToken);

    private PushPump Pump(IPushGateway? with = null) => new(
        store,
        with ?? gateway,
        new PushMessages(new FakeGroupDirectory(), new FakeNotificationRounds(), accounts),
        scheduler,
        clock,
        NullLogger<PushPump>.Instance);
}
