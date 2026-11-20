using System.Data;
using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Notifications.Domain;

namespace Sacou.Modules.Notifications.Infrastructure;

/// <summary>
/// The phones, under two advisory locks taken in a fixed order (the token, then the account), so two registrations of one
/// token or of one account run one after another and never deadlock. SQL is always parameterized (ADR 0037).
/// </summary>
internal sealed class PostgresPushDeviceStore(NotificationsDbContext database) : IPushDeviceStore
{
    /// <summary>First keys of the two-key advisory locks, so they never collide with another lock family.</summary>
    private const int TokenLockFamily = 6_901;
    private const int AccountLockFamily = 6_902;

    public async Task RegisterAsync(
        Guid userId, Guid installationId, PushToken token, PushPlatform platform, DateTimeOffset now, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(token);
        var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            await LockAsync(TokenLockFamily, token.Value, cancellationToken).ConfigureAwait(false);
            await LockAsync(AccountLockFamily, userId.ToString(), cancellationToken).ConfigureAwait(false);
            // A phone lent, or another login on it: the token leaves the other account (and its pending pushes go with it).
            _ = await database.PushDevices
                .Where(device => device.ExpoToken == token.Value && !(device.UserId == userId && device.InstallationId == installationId))
                .ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
            await UpsertAsync(userId, installationId, token, platform, now, cancellationToken).ConfigureAwait(false);
            await KeepNewestAsync(userId, installationId, now, cancellationToken).ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    public Task RemoveAsync(Guid userId, Guid installationId, CancellationToken cancellationToken) =>
        database.PushDevices.Where(device => device.UserId == userId && device.InstallationId == installationId)
            .ExecuteDeleteAsync(cancellationToken);

    public async Task<IReadOnlyList<PushDeviceRow>> ListAsync(Guid userId, CancellationToken cancellationToken) =>
        await database.PushDevices.AsNoTracking().Where(device => device.UserId == userId)
            .OrderBy(device => device.CreatedAt).ThenBy(device => device.Id)
            .ToListAsync(cancellationToken).ConfigureAwait(false);

    public async Task EraseAsync(Guid userId, IReadOnlyCollection<Guid> members, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(members);
        var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            await LockAsync(AccountLockFamily, userId.ToString(), cancellationToken).ConfigureAwait(false);
            // The deliveries go by ON DELETE CASCADE, from either side.
            _ = await database.PushDevices.Where(device => device.UserId == userId).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
            _ = await database.Notifications.Where(notification => members.Contains(notification.MemberId))
                .ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    private Task<int> LockAsync(int family, string key, CancellationToken cancellationToken) =>
        database.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock({family}, hashtext({key}))", cancellationToken);

    /// <summary>Writes only what changed, or a phone not seen for a day: a phone that opens the app ten times a day writes once.</summary>
    private Task<int> UpsertAsync(
        Guid userId, Guid installationId, PushToken token, PushPlatform platform, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var platformText = ColumnValues.Platforms[platform];
        var seenBefore = now - NotificationLimits.LastSeenResolution;
        return database.Database.ExecuteSqlAsync(
            $"""
            INSERT INTO notifications.push_devices (id, user_id, installation_id, expo_token, platform, created_at, last_seen_at)
            VALUES ({Guid.CreateVersion7(now)}, {userId}, {installationId}, {token.Value}, {platformText}, {now}, {now})
            ON CONFLICT (user_id, installation_id) DO UPDATE
            SET expo_token = EXCLUDED.expo_token, platform = EXCLUDED.platform, last_seen_at = EXCLUDED.last_seen_at,
                disabled_at = NULL, disabled_reason = NULL
            WHERE push_devices.expo_token <> EXCLUDED.expo_token OR push_devices.platform <> EXCLUDED.platform
               OR push_devices.disabled_at IS NOT NULL OR push_devices.last_seen_at < {seenBefore}
            """,
            cancellationToken);
    }

    /// <summary>Past the ceiling, the least recently seen phones are turned off (never the one registering): their pending pushes stay unsent.</summary>
    private Task<int> KeepNewestAsync(Guid userId, Guid installationId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var reason = ColumnValues.OverDeviceLimit;
        return database.Database.ExecuteSqlAsync(
            $"""
            UPDATE notifications.push_devices SET disabled_at = {now}, disabled_reason = {reason}
            WHERE id IN (
                SELECT id FROM notifications.push_devices
                WHERE user_id = {userId} AND disabled_at IS NULL
                ORDER BY (installation_id = {installationId}) DESC, last_seen_at DESC, created_at DESC, id DESC
                OFFSET {NotificationLimits.MaxActiveDevices})
            """,
            cancellationToken);
    }
}
