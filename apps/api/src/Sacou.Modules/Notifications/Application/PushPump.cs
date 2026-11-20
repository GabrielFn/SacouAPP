using Microsoft.Extensions.Logging;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Notifications.Contracts;
using Sacou.Modules.Notifications.Domain;
using Sacou.Modules.Notifications.Infrastructure;

namespace Sacou.Modules.Notifications.Application;

/// <summary>
/// The pump (ADR 0069, D5): recovers the stale, then claims due deliveries in batches, sends each batch and records what
/// the service said. A batch is claimed and committed before anything is sent, so two pumps never send one delivery.
/// What is recorded after the send is never cancelled: a delivery left sending would only count as unknown later.
/// </summary>
internal sealed class PushPump(
    IDeliveryStore deliveries, IPushGateway gateway, PushMessages messages, TimeProvider time, ILogger<PushPump> logger) : INotificationPump
{
    public async Task RunAsync(CancellationToken cancellationToken)
    {
        if (!gateway.IsEnabled)
        {
            return;
        }

        await deliveries.RecoverAsync(time.GetUtcNow(), cancellationToken).ConfigureAwait(false);
        int claimed;
        do
        {
            claimed = await PumpBatchAsync(cancellationToken).ConfigureAwait(false);
        }
        while (claimed == NotificationLimits.SendBatchSize && !cancellationToken.IsCancellationRequested);
    }

    private async Task<int> PumpBatchAsync(CancellationToken cancellationToken)
    {
        var batch = await deliveries.ClaimAsync(time.GetUtcNow(), NotificationLimits.SendBatchSize, cancellationToken).ConfigureAwait(false);
        if (batch.Count == 0)
        {
            return 0;
        }

        var composed = await messages.ComposeAsync(batch, cancellationToken).ConfigureAwait(false);
        var results = composed.Messages.Count == 0
            ? []
            : await gateway.SendAsync(composed.Messages, cancellationToken).ConfigureAwait(false);
        var outcomes = PushOutcomes.Of(batch, [.. results, .. composed.Unsendable], time.GetUtcNow());
        await deliveries.RecordAsync(outcomes, time.GetUtcNow(), CancellationToken.None).ConfigureAwait(false);
        Log(outcomes);
        return batch.Count;
    }

    private void Log(IReadOnlyList<DeliveryOutcome> outcomes)
    {
        foreach (var refused in outcomes.Where(outcome => outcome.State == DeliveryState.Failed && !outcome.DisableDevice))
        {
            NotificationLog.DeliveryFailed(logger, refused.DeliveryId, refused.ErrorCode ?? PushOutcomes.NoAnswer);
        }

        var byState = outcomes.CountBy(outcome => outcome.State).ToDictionary();
        var sent = byState.GetValueOrDefault(DeliveryState.Sent);
        var retry = byState.GetValueOrDefault(DeliveryState.Pending);
        var failed = byState.GetValueOrDefault(DeliveryState.Failed);
        var unknown = byState.GetValueOrDefault(DeliveryState.Unknown);
        NotificationLog.Pumped(logger, outcomes.Count, sent, retry, failed, unknown);
    }
}

/// <summary>The messages of a batch, and the deliveries that cannot become one (their round is gone).</summary>
internal sealed record ComposedBatch(IReadOnlyList<PushMessage> Messages, IReadOnlyList<PushResult> Unsendable);

/// <summary>
/// Builds each push from ids (ADR 0069, D6 and D7): the group's current name and the round's local day and hour, rendered
/// now. Never the venue nor a name. <c>data</c> has the kind and three ids only; the expiration is the round's start.
/// </summary>
internal sealed class PushMessages(IGroupDirectory groups, INotificationRounds rounds)
{
    public const string RoundMissing = "round-missing";

    /// <summary>The kind the app reads in <c>data</c>, from a closed list.</summary>
    public const string WaitlistPromotedKind = "waitlistPromoted";

    public async Task<ComposedBatch> ComposeAsync(IReadOnlyList<ClaimedDelivery> batch, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(batch);
        var names = new Dictionary<Guid, string>();
        foreach (var group in batch.Select(delivery => delivery.GroupId).Distinct())
        {
            names[group] = await groups.FindNameAsync(group, cancellationToken).ConfigureAwait(false) ?? NotificationTexts.UnknownGroup;
        }

        var keys = batch.Select(delivery => new NotificationRoundKey(delivery.GroupId, delivery.RoundId)).Distinct().ToList();
        var found = (await rounds.FindAsync(keys, cancellationToken).ConfigureAwait(false))
            .ToDictionary(round => new NotificationRoundKey(round.GroupId, round.RoundId));
        var messages = new List<PushMessage>();
        var unsendable = new List<PushResult>();
        foreach (var delivery in batch)
        {
            if (found.TryGetValue(new NotificationRoundKey(delivery.GroupId, delivery.RoundId), out var round))
            {
                messages.Add(Compose(delivery, names[delivery.GroupId], round));
            }
            else
            {
                unsendable.Add(new PushResult(delivery.DeliveryId, PushResultKind.Failed, Code: RoundMissing));
            }
        }

        return new ComposedBatch(messages, unsendable);
    }

    public static PushMessage Compose(ClaimedDelivery delivery, string groupName, NotificationRound round)
    {
        ArgumentNullException.ThrowIfNull(delivery);
        ArgumentNullException.ThrowIfNull(round);
        return new PushMessage(
            delivery.DeliveryId,
            delivery.ExpoToken,
            NotificationTexts.PushTitle,
            NotificationTexts.PushBody(groupName, round.LocalDate, round.LocalTime),
            new PushData(WaitlistPromotedKind, delivery.NotificationId, delivery.GroupId, delivery.RoundId),
            delivery.ExpiresAt);
    }
}

/// <summary>The gateway of part 1 of E3.11: sends nothing, so the pump claims nothing and every delivery stays pending.</summary>
internal sealed class DisabledPushGateway : IPushGateway
{
    public bool IsEnabled => false;

    public Task<IReadOnlyList<PushResult>> SendAsync(IReadOnlyList<PushMessage> messages, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<PushResult>>([]);
}
