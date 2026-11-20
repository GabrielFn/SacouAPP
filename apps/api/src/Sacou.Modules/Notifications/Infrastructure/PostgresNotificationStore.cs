using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Notifications.Domain;

namespace Sacou.Modules.Notifications.Infrastructure;

/// <summary>SQL is always parameterized: EF turns the interpolated values into parameters (ADR 0037).</summary>
internal sealed class PostgresNotificationStore(NotificationsDbContext database) : INotificationStore
{
    public Task<int> AddAsync(NotificationRow notification, Guid userId, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(notification);
        var pending = ColumnValues.States[DeliveryState.Pending];
        var now = notification.CreatedAt;
        // One statement, so one implicit transaction: the deliveries exist only if this call inserted the notification.
        return database.Database.ExecuteSqlAsync(
            $"""
            WITH inserted AS (
                INSERT INTO notifications.notifications (id, dedupe_key, kind, member_id, group_id, round_id, created_at, expires_at)
                VALUES ({notification.Id}, {notification.DedupeKey}, {notification.Kind}, {notification.MemberId},
                        {notification.GroupId}, {notification.RoundId}, {now}, {notification.ExpiresAt})
                ON CONFLICT (dedupe_key) DO NOTHING
                RETURNING id)
            INSERT INTO notifications.push_deliveries (id, notification_id, device_id, state, attempts, next_attempt_at, created_at, updated_at)
            SELECT gen_random_uuid(), inserted.id, device.id, {pending}, 0, {now}, {now}, {now}
            FROM inserted CROSS JOIN notifications.push_devices device
            WHERE device.user_id = {userId} AND device.disabled_at IS NULL
            ON CONFLICT (notification_id, device_id) DO NOTHING
            """,
            cancellationToken);
    }

    public async Task<IReadOnlyList<NotificationRow>> ListAsync(
        IReadOnlyCollection<Guid> members, NotificationCursor? after, int take, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(members);
        var ids = members.ToArray();
        var page = after is null
            ? database.Notifications.FromSql(
                $"SELECT * FROM notifications.notifications WHERE member_id = ANY ({ids}) ORDER BY created_at DESC, id DESC LIMIT {take}")
            : database.Notifications.FromSql(
                $"""
                SELECT * FROM notifications.notifications
                WHERE member_id = ANY ({ids}) AND (created_at, id) < ({after.CreatedAt}, {after.Id})
                ORDER BY created_at DESC, id DESC LIMIT {take}
                """);
        return await page.AsNoTracking().ToListAsync(cancellationToken).ConfigureAwait(false);
    }

    public Task<int> CountUnreadAsync(IReadOnlyCollection<Guid> members, CancellationToken cancellationToken) =>
        database.Notifications.AsNoTracking().CountAsync(row => members.Contains(row.MemberId) && row.ReadAt == null, cancellationToken);

    public async Task<bool> MarkReadAsync(IReadOnlyCollection<Guid> members, Guid notification, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var mine = database.Notifications.Where(row => row.Id == notification && members.Contains(row.MemberId));
        if (!await mine.AnyAsync(cancellationToken).ConfigureAwait(false))
        {
            return false;
        }

        _ = await mine.Where(row => row.ReadAt == null)
            .ExecuteUpdateAsync(update => update.SetProperty(row => row.ReadAt, now), cancellationToken).ConfigureAwait(false);
        return true;
    }

    public Task MarkAllReadAsync(IReadOnlyCollection<Guid> members, DateTimeOffset now, CancellationToken cancellationToken) =>
        database.Notifications.Where(row => members.Contains(row.MemberId) && row.ReadAt == null)
            .ExecuteUpdateAsync(update => update.SetProperty(row => row.ReadAt, now), cancellationToken);
}
