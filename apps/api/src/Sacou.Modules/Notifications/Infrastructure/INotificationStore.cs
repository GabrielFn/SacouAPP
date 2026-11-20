using Sacou.Modules.Notifications.Domain;

namespace Sacou.Modules.Notifications.Infrastructure;

/// <summary>Where a page of screen 28 starts: after this notification, newest first.</summary>
internal sealed record NotificationCursor(DateTimeOffset CreatedAt, Guid Id);

/// <summary>The notifications and their fan-out to the phones (ADR 0069, D3). Always by the person's member ids.</summary>
internal interface INotificationStore
{
    /// <summary>
    /// In one statement: inserts the notification, and only when it is new (<c>ON CONFLICT (dedupe_key) DO NOTHING</c>),
    /// one pending delivery per active phone of <paramref name="userId"/>. Answers the deliveries made: zero on a repeat.
    /// </summary>
    Task<int> AddAsync(NotificationRow notification, Guid userId, CancellationToken cancellationToken);

    /// <summary>Newest first, after <paramref name="after"/> when given.</summary>
    Task<IReadOnlyList<NotificationRow>> ListAsync(
        IReadOnlyCollection<Guid> members, NotificationCursor? after, int take, CancellationToken cancellationToken);

    Task<int> CountUnreadAsync(IReadOnlyCollection<Guid> members, CancellationToken cancellationToken);

    /// <summary>False when no notification of these members has the id; reading one already read changes nothing.</summary>
    Task<bool> MarkReadAsync(IReadOnlyCollection<Guid> members, Guid notification, DateTimeOffset now, CancellationToken cancellationToken);

    Task MarkAllReadAsync(IReadOnlyCollection<Guid> members, DateTimeOffset now, CancellationToken cancellationToken);
}

/// <summary>The phones of an account (ADR 0069, D8). The only store that sees a user id and a token.</summary>
internal interface IPushDeviceStore
{
    /// <summary>
    /// The idempotent upsert of one installation, under per-token and per-account locks: the same token elsewhere (another
    /// account, another installation) is deleted first; a new token replaces the old one; a turned-off phone comes back;
    /// a phone seen within a day is not written; past <see cref="NotificationLimits.MaxActiveDevices"/> the least recently
    /// seen is turned off.
    /// </summary>
    Task RegisterAsync(Guid userId, Guid installationId, PushToken token, PushPlatform platform, DateTimeOffset now, CancellationToken cancellationToken);

    /// <summary>Deletes the installation of this account, if it has one; nothing for another account's.</summary>
    Task RemoveAsync(Guid userId, Guid installationId, CancellationToken cancellationToken);

    /// <summary>The account's phones, for the export: never the token nor the installation id.</summary>
    Task<IReadOnlyList<PushDeviceRow>> ListAsync(Guid userId, CancellationToken cancellationToken);

    /// <summary>In one transaction: the account's phones and the notifications of its members, with their deliveries.</summary>
    Task EraseAsync(Guid userId, IReadOnlyCollection<Guid> members, CancellationToken cancellationToken);
}
