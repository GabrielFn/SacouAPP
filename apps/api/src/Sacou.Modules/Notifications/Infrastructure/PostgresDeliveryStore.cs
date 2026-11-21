using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Notifications.Domain;

namespace Sacou.Modules.Notifications.Infrastructure;

/// <summary>
/// A delivery the pump owns now, with what its push needs and whom it is for: the member, and the account of the phone,
/// checked again before the send. The token and the user id never leave the pump and the gateway.
/// </summary>
internal sealed record ClaimedDelivery(
    Guid DeliveryId, int Attempts, Guid NotificationId, string Kind, Guid MemberId, Guid GroupId, Guid RoundId, DateTimeOffset ExpiresAt,
    Guid DeviceId, Guid UserId, string ExpoToken)
{
    /// <summary>Never prints the token nor the user id.</summary>
    public override string ToString() => $"ClaimedDelivery {{ DeliveryId = {DeliveryId} }}";
}

/// <summary>A delivery the push service took, whose receipt is due: by its ticket.</summary>
internal sealed record SentDelivery(Guid DeliveryId, Guid DeviceId, string TicketId, DateTimeOffset CreatedAt);

/// <summary>How one claimed delivery ends this run. <see cref="ErrorCode"/> is the push service's code, never a token.</summary>
internal sealed record DeliveryOutcome(
    Guid DeliveryId, Guid DeviceId, DeliveryState State, DateTimeOffset NextAttemptAt, string? TicketId, string? ErrorCode, bool DisableDevice);

/// <summary>The pump's side of the deliveries (ADR 0069, D5).</summary>
internal interface IDeliveryStore
{
    /// <summary>Pending ones whose round started become expired; sending ones whose lease ran out (a pump died) become unknown.</summary>
    Task RecoverAsync(DateTimeOffset now, CancellationToken cancellationToken);

    /// <summary>
    /// In one statement (so one committed transaction before anything is sent): up to <paramref name="take"/> pending
    /// deliveries that are due, of active phones, whose round has not started, become sending with one more attempt and a
    /// lease. <c>FOR UPDATE SKIP LOCKED</c>: two pumps at once never claim the same delivery.
    /// </summary>
    Task<IReadOnlyList<ClaimedDelivery>> ClaimAsync(DateTimeOffset now, int take, CancellationToken cancellationToken);

    /// <summary>Writes each outcome on a delivery still sending; turns off the phones the service no longer knows.</summary>
    Task RecordAsync(IReadOnlyList<DeliveryOutcome> outcomes, DateTimeOffset now, CancellationToken cancellationToken);

    /// <summary>
    /// Up to <paramref name="take"/> sent deliveries whose receipt is due, pushed back by <see cref="NotificationLimits.ReceiptDelay"/>
    /// in the same statement: two pumps never read one receipt, and a read that fails is tried again later.
    /// </summary>
    Task<IReadOnlyList<SentDelivery>> ClaimReceiptsAsync(DateTimeOffset now, int take, CancellationToken cancellationToken);

    /// <summary>Writes what the receipts said on deliveries still sent; turns off the phones the service no longer knows.</summary>
    Task RecordReceiptsAsync(IReadOnlyList<DeliveryOutcome> outcomes, DateTimeOffset now, CancellationToken cancellationToken);

    /// <summary>When the pump next has something to do (a try, a receipt, a lease to recover); null when nothing waits.</summary>
    Task<DateTimeOffset?> NextDueAsync(DateTimeOffset now, CancellationToken cancellationToken);
}

internal sealed class PostgresDeliveryStore(NotificationsDbContext database) : IDeliveryStore
{
    private static readonly string Pending = ColumnValues.States[DeliveryState.Pending];
    private static readonly string Sending = ColumnValues.States[DeliveryState.Sending];
    private static readonly string Sent = ColumnValues.States[DeliveryState.Sent];

    public async Task RecoverAsync(DateTimeOffset now, CancellationToken cancellationToken)
    {
        var expired = ColumnValues.States[DeliveryState.Expired];
        var unknown = ColumnValues.States[DeliveryState.Unknown];
        _ = await database.Database.ExecuteSqlAsync(
            $"""
            UPDATE notifications.push_deliveries AS delivery SET state = {expired}, updated_at = {now}
            FROM notifications.notifications AS notification
            WHERE notification.id = delivery.notification_id AND delivery.state = {Pending} AND notification.expires_at <= {now}
            """,
            cancellationToken).ConfigureAwait(false);
        _ = await database.Database.ExecuteSqlAsync(
            $"""
            UPDATE notifications.push_deliveries SET state = {unknown}, lease_until = NULL, updated_at = {now}
            WHERE state = {Sending} AND lease_until <= {now}
            """,
            cancellationToken).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<ClaimedDelivery>> ClaimAsync(DateTimeOffset now, int take, CancellationToken cancellationToken)
    {
        var leaseUntil = now + NotificationLimits.SendingLease;
        return await database.Database.SqlQuery<ClaimedDelivery>(
            $"""
            UPDATE notifications.push_deliveries AS delivery
            SET state = {Sending}, attempts = delivery.attempts + 1, lease_until = {leaseUntil}, updated_at = {now}
            FROM notifications.notifications AS notification, notifications.push_devices AS device
            WHERE delivery.id IN (
                    SELECT candidate.id FROM notifications.push_deliveries AS candidate
                    JOIN notifications.notifications AS owner ON owner.id = candidate.notification_id
                    JOIN notifications.push_devices AS phone ON phone.id = candidate.device_id
                    WHERE candidate.state = {Pending} AND candidate.next_attempt_at <= {now}
                      AND owner.expires_at > {now} AND phone.disabled_at IS NULL
                    ORDER BY candidate.next_attempt_at, candidate.id
                    LIMIT {take}
                    FOR UPDATE OF candidate SKIP LOCKED)
              AND notification.id = delivery.notification_id AND device.id = delivery.device_id
            RETURNING delivery.id AS "DeliveryId", delivery.attempts AS "Attempts", notification.id AS "NotificationId",
                      notification.kind AS "Kind", notification.member_id AS "MemberId", notification.group_id AS "GroupId",
                      notification.round_id AS "RoundId", notification.expires_at AS "ExpiresAt", device.id AS "DeviceId",
                      device.user_id AS "UserId", device.expo_token AS "ExpoToken"
            """).ToListAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task RecordAsync(IReadOnlyList<DeliveryOutcome> outcomes, DateTimeOffset now, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(outcomes);
        foreach (var outcome in outcomes)
        {
            var state = ColumnValues.States[outcome.State];
            _ = await database.Database.ExecuteSqlAsync(
                $"""
                UPDATE notifications.push_deliveries
                SET state = {state}, next_attempt_at = {outcome.NextAttemptAt}, lease_until = NULL,
                    ticket_id = {outcome.TicketId}, error_code = {outcome.ErrorCode}, updated_at = {now}
                WHERE id = {outcome.DeliveryId} AND state = {Sending}
                """,
                cancellationToken).ConfigureAwait(false);
        }

        await DisableAsync(outcomes, now, cancellationToken).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<SentDelivery>> ClaimReceiptsAsync(DateTimeOffset now, int take, CancellationToken cancellationToken)
    {
        var later = now + NotificationLimits.ReceiptDelay;
        return await database.Database.SqlQuery<SentDelivery>(
            $"""
            UPDATE notifications.push_deliveries AS delivery SET next_attempt_at = {later}, updated_at = {now}
            WHERE delivery.id IN (
                SELECT candidate.id FROM notifications.push_deliveries AS candidate
                WHERE candidate.state = {Sent} AND candidate.ticket_id IS NOT NULL AND candidate.next_attempt_at <= {now}
                ORDER BY candidate.next_attempt_at, candidate.id
                LIMIT {take}
                FOR UPDATE SKIP LOCKED)
            RETURNING delivery.id AS "DeliveryId", delivery.device_id AS "DeviceId", delivery.ticket_id AS "TicketId",
                      delivery.created_at AS "CreatedAt"
            """).ToListAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task RecordReceiptsAsync(IReadOnlyList<DeliveryOutcome> outcomes, DateTimeOffset now, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(outcomes);
        foreach (var outcome in outcomes)
        {
            var state = ColumnValues.States[outcome.State];
            _ = await database.Database.ExecuteSqlAsync(
                $"""
                UPDATE notifications.push_deliveries
                SET state = {state}, next_attempt_at = {outcome.NextAttemptAt}, error_code = {outcome.ErrorCode}, updated_at = {now}
                WHERE id = {outcome.DeliveryId} AND state = {Sent}
                """,
                cancellationToken).ConfigureAwait(false);
        }

        await DisableAsync(outcomes, now, cancellationToken).ConfigureAwait(false);
    }

    public async Task<DateTimeOffset?> NextDueAsync(DateTimeOffset now, CancellationToken cancellationToken) =>
        await database.Database.SqlQuery<DateTimeOffset?>(
            $"""
            SELECT min(due) AS "Value" FROM (
                SELECT min(delivery.next_attempt_at) AS due FROM notifications.push_deliveries AS delivery
                JOIN notifications.notifications AS notification ON notification.id = delivery.notification_id
                JOIN notifications.push_devices AS device ON device.id = delivery.device_id
                WHERE delivery.state = {Pending} AND notification.expires_at > {now} AND device.disabled_at IS NULL
                UNION ALL
                SELECT min(next_attempt_at) FROM notifications.push_deliveries WHERE state = {Sent} AND ticket_id IS NOT NULL
                UNION ALL
                SELECT min(lease_until) FROM notifications.push_deliveries WHERE state = {Sending}) AS waiting
            """).SingleAsync(cancellationToken).ConfigureAwait(false);

    private async Task DisableAsync(IReadOnlyList<DeliveryOutcome> outcomes, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var unregistered = outcomes.Where(outcome => outcome.DisableDevice).Select(outcome => outcome.DeviceId).Distinct().ToArray();
        if (unregistered.Length == 0)
        {
            return;
        }

        var reason = ColumnValues.NotRegistered;
        _ = await database.PushDevices.Where(device => unregistered.Contains(device.Id) && device.DisabledAt == null)
            .ExecuteUpdateAsync(update => update.SetProperty(device => device.DisabledAt, now).SetProperty(device => device.DisabledReason, reason), cancellationToken)
            .ConfigureAwait(false);
    }
}
