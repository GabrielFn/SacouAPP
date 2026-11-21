using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Notifications.Domain;

namespace Sacou.Modules.Notifications.Infrastructure;

/// <summary>
/// The cleanup of the module (ADR 0069, D12), run by the internal pump route: ended deliveries after 7 days and
/// notifications after 30 (their deliveries go by cascade), in batches of <see cref="NotificationLimits.CleanUpBatchSize"/>.
/// </summary>
internal interface INotificationRetention
{
    Task CleanUpAsync(DateTimeOffset now, CancellationToken cancellationToken);
}

internal sealed class PostgresNotificationRetention(NotificationsDbContext database) : INotificationRetention
{
    private static readonly string[] Ended =
        [.. new[] { DeliveryState.Delivered, DeliveryState.Failed, DeliveryState.Unknown, DeliveryState.Expired }.Select(state => ColumnValues.States[state])];

    public async Task CleanUpAsync(DateTimeOffset now, CancellationToken cancellationToken)
    {
        var deliveriesBefore = now - NotificationLimits.ClosedDeliveryRetention;
        var notificationsBefore = now - NotificationLimits.NotificationRetention;
        await DeleteInBatchesAsync(
            () => database.Database.ExecuteSqlAsync(
                $"""
                DELETE FROM notifications.push_deliveries WHERE id IN (
                    SELECT id FROM notifications.push_deliveries
                    WHERE state = ANY({Ended}) AND updated_at < {deliveriesBefore}
                    LIMIT {NotificationLimits.CleanUpBatchSize})
                """,
                cancellationToken),
            cancellationToken).ConfigureAwait(false);
        await DeleteInBatchesAsync(
            () => database.Database.ExecuteSqlAsync(
                $"""
                DELETE FROM notifications.notifications WHERE id IN (
                    SELECT id FROM notifications.notifications WHERE created_at < {notificationsBefore}
                    LIMIT {NotificationLimits.CleanUpBatchSize})
                """,
                cancellationToken),
            cancellationToken).ConfigureAwait(false);
    }

    private static async Task DeleteInBatchesAsync(Func<Task<int>> deleteBatch, CancellationToken cancellationToken)
    {
        int deleted;
        do
        {
            deleted = await deleteBatch().ConfigureAwait(false);
        }
        while (deleted == NotificationLimits.CleanUpBatchSize && !cancellationToken.IsCancellationRequested);
    }
}
