using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Notifications.Infrastructure;

namespace Sacou.Modules.Notifications.AccountData;

/// <summary>
/// The account deletion in the Notifications (ADR 0069, D9; ADR 0056): the phones of the account and the notifications of
/// its members go, their deliveries with them. It must run before the Groups' erasure, which unlinks the member ids from
/// the account: the module registers it first (a test checks the order). <see cref="ErasureMode.Checked"/> writes nothing
/// while a group blocks the deletion (the Groups then refuses it); <see cref="ErasureMode.Sweep"/> takes the phones
/// registered in between. Both idempotent. No event, no log of an id.
/// </summary>
internal sealed class NotificationsAccountErasure(
    IAccountDeletionBlockers blockers, IGroupMembership membership, IPushDeviceStore devices) : IAccountErasure
{
    public async Task<IReadOnlyList<Guid>> EraseAsync(Guid userId, ErasureMode mode, CancellationToken cancellationToken)
    {
        if (mode == ErasureMode.Checked && (await blockers.FindAsync(userId, cancellationToken).ConfigureAwait(false)).Count > 0)
        {
            return [];
        }

        var members = await membership.ListMemberIdsOfUserAsync(userId, cancellationToken).ConfigureAwait(false);
        await devices.EraseAsync(userId, members, cancellationToken).ConfigureAwait(false);
        return [];
    }
}

/// <summary>
/// "Notificações" of the export (ADR 0069, D9): the phones by platform and dates, never the token (the capability to reach
/// the phone) nor the installation id; and the notifications by kind, ids and dates. The text is not stored, so not exported.
/// </summary>
internal sealed class NotificationsExportSection(IGroupMembership membership, IPushDeviceStore devices, INotificationStore notifications)
    : IAccountExportSection
{
    /// <summary>Far above what 30 days of retention can hold.</summary>
    private const int ExportCeiling = 10_000;

    public string Name => AccountExportSections.Notifications;

    public int Order => AccountExportSections.NotificationsOrder;

    public async Task<object?> ExportAsync(Guid userId, CancellationToken cancellationToken)
    {
        var phones = await devices.ListAsync(userId, cancellationToken).ConfigureAwait(false);
        var members = await membership.ListMemberIdsOfUserAsync(userId, cancellationToken).ConfigureAwait(false);
        var received = await notifications.ListAsync(members, after: null, ExportCeiling, cancellationToken).ConfigureAwait(false);
        return new NotificationsExport(
            [.. phones.Select(phone => new PushDeviceExportEntry(phone.Platform, phone.CreatedAt, phone.LastSeenAt, phone.DisabledAt is null))],
            [.. received.OrderBy(row => row.CreatedAt).ThenBy(row => row.Id)
                .Select(row => new NotificationExportEntry(row.Kind, row.MemberId, row.GroupId, row.RoundId, row.CreatedAt, row.ReadAt))]);
    }
}

internal sealed record NotificationsExport(IReadOnlyList<PushDeviceExportEntry> Devices, IReadOnlyList<NotificationExportEntry> Notifications);

internal sealed record PushDeviceExportEntry(string Platform, DateTimeOffset CreatedAt, DateTimeOffset LastSeenAt, bool Active);

internal sealed record NotificationExportEntry(string Kind, Guid MemberId, Guid GroupId, Guid RoundId, DateTimeOffset CreatedAt, DateTimeOffset? ReadAt);
