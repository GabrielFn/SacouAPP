using Microsoft.Extensions.Logging;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Notifications.Contracts;
using Sacou.Modules.Notifications.Domain;
using Sacou.Modules.Notifications.Infrastructure;

namespace Sacou.Modules.Notifications.Application;

/// <summary>
/// The fan-out (ADR 0069, D3 and D4): the member becomes an account through the Groups contract; a guest without an
/// account, a former member or a deleted account gets nothing. Otherwise one notification, and one delivery per active
/// phone of the account, both only the first time the dedupe key is seen.
/// </summary>
internal sealed class NotificationRequestHandler(
    IMemberAccounts accounts, INotificationStore store, TimeProvider time, ILogger<NotificationRequestHandler> logger) : INotificationRequests
{
    public async Task RequestAsync(NotificationRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.DedupeKey);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(request.DedupeKey.Length, NotificationConfiguration.MaxDedupeKeyLength);
        var user = await accounts.FindUserOfActiveMemberAsync(request.MemberId, cancellationToken).ConfigureAwait(false);
        if (user is not { } recipient)
        {
            NotificationLog.NoRecipient(logger, request.RoundId);
            return;
        }

        var now = time.GetUtcNow();
        var notification = new NotificationRow
        {
            Id = Guid.CreateVersion7(now),
            DedupeKey = request.DedupeKey,
            Kind = ColumnValues.Kinds[ToKind(request.Kind)],
            MemberId = request.MemberId,
            GroupId = request.GroupId,
            RoundId = request.RoundId,
            CreatedAt = now,
            ExpiresAt = request.ExpiresAt,
        };
        var deliveries = await store.AddAsync(notification, recipient, cancellationToken).ConfigureAwait(false);
        NotificationLog.Requested(logger, request.RoundId, deliveries);
    }

    private static NotificationKind ToKind(NotificationRequestKind kind) => kind switch
    {
        NotificationRequestKind.WaitlistPromoted => NotificationKind.WaitlistPromoted,
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Every request kind has a notification kind."),
    };
}
