using Microsoft.Extensions.Logging;
using Sacou.Modules.Notifications.Contracts;
using Sacou.Modules.Notifications.Domain;
using Sacou.Modules.Notifications.Infrastructure;

namespace Sacou.Modules.Notifications.Application;

/// <summary>
/// The pump (ADR 0069, D5 and D10): recovers the stale, claims due deliveries in batches, sends each batch and records
/// what the service said, then reads the receipts that are due, and last asks the scheduler for a call when the next
/// thing is due. A batch is claimed and committed before anything is sent, so two pumps never send one delivery. What
/// is sent and recorded after the claim is never cancelled: a delivery left sending would only count as unknown later.
/// </summary>
internal sealed class PushPump(
    IDeliveryStore deliveries,
    IPushGateway gateway,
    PushMessages messages,
    INotificationScheduler scheduler,
    TimeProvider time,
    ILogger<PushPump> logger) : INotificationPump
{
    public async Task RunAsync(CancellationToken cancellationToken)
    {
        if (!gateway.IsEnabled)
        {
            return;
        }

        try
        {
            await deliveries.RecoverAsync(time.GetUtcNow(), cancellationToken).ConfigureAwait(false);
            await RepeatAsync(PumpBatchAsync, NotificationLimits.SendBatchSize, cancellationToken).ConfigureAwait(false);
            await RepeatAsync(ReadReceiptsAsync, NotificationLimits.ReceiptBatchSize, cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            // Also after a cut budget: what was left gets its call, never only the next write.
            await ScheduleNextAsync().ConfigureAwait(false);
        }
    }

    private static async Task RepeatAsync(Func<CancellationToken, Task<int>> batch, int fullBatch, CancellationToken cancellationToken)
    {
        int taken;
        do
        {
            taken = await batch(cancellationToken).ConfigureAwait(false);
        }
        while (taken == fullBatch && !cancellationToken.IsCancellationRequested);
    }

    private async Task<int> PumpBatchAsync(CancellationToken cancellationToken)
    {
        var batch = await deliveries.ClaimAsync(time.GetUtcNow(), NotificationLimits.SendBatchSize, cancellationToken).ConfigureAwait(false);
        if (batch.Count == 0)
        {
            return 0;
        }

        // From the claim on, nothing is cancelled: a send cut in the middle would be ambiguous for every message.
        var composed = await messages.ComposeAsync(batch, CancellationToken.None).ConfigureAwait(false);
        var results = composed.Messages.Count == 0
            ? []
            : await gateway.SendAsync(composed.Messages, CancellationToken.None).ConfigureAwait(false);
        var outcomes = PushOutcomes.Of(batch, [.. results, .. composed.Unsendable], time.GetUtcNow());
        await deliveries.RecordAsync(outcomes, time.GetUtcNow(), CancellationToken.None).ConfigureAwait(false);
        Log(outcomes);
        return batch.Count;
    }

    private async Task<int> ReadReceiptsAsync(CancellationToken cancellationToken)
    {
        var sent = await deliveries.ClaimReceiptsAsync(time.GetUtcNow(), NotificationLimits.ReceiptBatchSize, cancellationToken).ConfigureAwait(false);
        if (sent.Count == 0)
        {
            return 0;
        }

        var receipts = await gateway.GetReceiptsAsync([.. sent.Select(delivery => delivery.TicketId)], CancellationToken.None).ConfigureAwait(false);
        var outcomes = ReceiptOutcomes.Of(sent, receipts, time.GetUtcNow());
        await deliveries.RecordReceiptsAsync(outcomes, time.GetUtcNow(), CancellationToken.None).ConfigureAwait(false);
        LogReceipts(sent.Count, outcomes);
        return sent.Count;
    }

    private async Task ScheduleNextAsync()
    {
        try
        {
            var now = time.GetUtcNow();
            if (await deliveries.NextDueAsync(now, CancellationToken.None).ConfigureAwait(false) is { } due)
            {
                await scheduler.ScheduleAsync(due, CancellationToken.None).ConfigureAwait(false);
            }
        }
#pragma warning disable CA1031 // Scheduling is best effort: the daily sweep and the next write catch up (ADR 0069, D10).
        catch (Exception exception)
#pragma warning restore CA1031
        {
            NotificationLog.ScheduleFailed(logger, exception.GetType().Name);
        }
    }

    private void Log(IReadOnlyList<DeliveryOutcome> outcomes)
    {
        LogFailures(outcomes);
        var byState = outcomes.CountBy(outcome => outcome.State).ToDictionary();
        var sent = byState.GetValueOrDefault(DeliveryState.Sent);
        var retry = byState.GetValueOrDefault(DeliveryState.Pending);
        var failed = byState.GetValueOrDefault(DeliveryState.Failed);
        var unknown = byState.GetValueOrDefault(DeliveryState.Unknown);
        NotificationLog.Pumped(logger, outcomes.Count, sent, retry, failed, unknown);
    }

    private void LogReceipts(int read, IReadOnlyList<DeliveryOutcome> outcomes)
    {
        LogFailures(outcomes);
        var byState = outcomes.CountBy(outcome => outcome.State).ToDictionary();
        var delivered = byState.GetValueOrDefault(DeliveryState.Delivered);
        var failed = byState.GetValueOrDefault(DeliveryState.Failed);
        var unknown = byState.GetValueOrDefault(DeliveryState.Unknown);
        NotificationLog.ReceiptsRead(logger, read, delivered, failed, unknown);
    }

    /// <summary>A failure that is not a phone gone is our defect or a credential: logged by its delivery and code.</summary>
    private void LogFailures(IReadOnlyList<DeliveryOutcome> outcomes)
    {
        foreach (var refused in outcomes.Where(outcome => outcome.State == DeliveryState.Failed && !outcome.DisableDevice))
        {
            NotificationLog.DeliveryFailed(logger, refused.DeliveryId, refused.ErrorCode ?? PushOutcomes.NoAnswer);
        }
    }
}
