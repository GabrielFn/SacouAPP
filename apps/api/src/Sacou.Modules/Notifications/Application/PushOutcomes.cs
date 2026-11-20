using Sacou.Modules.Notifications.Domain;
using Sacou.Modules.Notifications.Infrastructure;

namespace Sacou.Modules.Notifications.Application;

/// <summary>
/// What each answer of the push service does to a claimed delivery (ADR 0069, D5), as a pure function. A message the
/// service did not answer about is ambiguous: it is never sent again, so a phone never gets it twice.
/// </summary>
internal static class PushOutcomes
{
    public const string NoAnswer = "no-answer";

    public static IReadOnlyList<DeliveryOutcome> Of(IReadOnlyList<ClaimedDelivery> claimed, IReadOnlyList<PushResult> results, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(claimed);
        ArgumentNullException.ThrowIfNull(results);
        var byDelivery = results.GroupBy(result => result.DeliveryId).ToDictionary(group => group.Key, group => group.First());
        return [.. claimed.Select(delivery => byDelivery.TryGetValue(delivery.DeliveryId, out var result)
            ? Of(delivery, result, now)
            : Outcome(delivery, DeliveryState.Unknown, now, code: NoAnswer))];
    }

    public static DeliveryOutcome Of(ClaimedDelivery delivery, PushResult result, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(delivery);
        ArgumentNullException.ThrowIfNull(result);
        return result.Kind switch
        {
            PushResultKind.Accepted => Outcome(delivery, DeliveryState.Sent, now, ticket: result.TicketId),
            PushResultKind.DeviceNotRegistered => Outcome(delivery, DeliveryState.Failed, now, code: result.Code) with { DisableDevice = true },
            PushResultKind.Retry => Retry(delivery, result, now),
            PushResultKind.Failed => Outcome(delivery, DeliveryState.Failed, now, code: result.Code),
            PushResultKind.Ambiguous => Outcome(delivery, DeliveryState.Unknown, now, code: result.Code),
            _ => throw new ArgumentOutOfRangeException(nameof(result), result.Kind, "Every push result has an outcome."),
        };
    }

    private static DeliveryOutcome Retry(ClaimedDelivery delivery, PushResult result, DateTimeOffset now)
    {
        var (state, delay) = DeliveryRules.AfterRetryable(delivery.Attempts);
        return Outcome(delivery, state, now + delay, code: result.Code);
    }

    private static DeliveryOutcome Outcome(ClaimedDelivery delivery, DeliveryState state, DateTimeOffset nextAttemptAt, string? ticket = null, string? code = null)
    {
        // Every move starts from Sending: a refused one is a defect here, never a silent write.
        var moved = DeliveryRules.Move(DeliveryState.Sending, state);
        if (moved.IsFailure)
        {
            throw new InvalidOperationException(moved.Error.Code);
        }

        return new DeliveryOutcome(delivery.DeliveryId, delivery.DeviceId, state, nextAttemptAt, ticket, code, DisableDevice: false);
    }
}
