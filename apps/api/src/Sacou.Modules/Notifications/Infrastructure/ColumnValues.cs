using System.Collections.Immutable;
using Sacou.Modules.Notifications.Domain;

namespace Sacou.Modules.Notifications.Infrastructure;

/// <summary>
/// The text each enum value has in the database, written by hand so reordering or renaming an enum never changes
/// stored data. The CHECK constraints are built from the same lists.
/// </summary>
internal static class ColumnValues
{
    public const string NotRegistered = "not_registered";
    public const string OverDeviceLimit = "over_device_limit";

    public static readonly ImmutableDictionary<NotificationKind, string> Kinds = ImmutableDictionary<NotificationKind, string>.Empty
        .Add(NotificationKind.WaitlistPromoted, "waitlist_promoted");

    public static readonly ImmutableDictionary<PushPlatform, string> Platforms = ImmutableDictionary<PushPlatform, string>.Empty
        .Add(PushPlatform.Android, "android")
        .Add(PushPlatform.Ios, "ios");

    public static readonly ImmutableDictionary<DeliveryState, string> States = ImmutableDictionary<DeliveryState, string>.Empty
        .Add(DeliveryState.Pending, "pending")
        .Add(DeliveryState.Sending, "sending")
        .Add(DeliveryState.Sent, "sent")
        .Add(DeliveryState.Delivered, "delivered")
        .Add(DeliveryState.Failed, "failed")
        .Add(DeliveryState.Unknown, "unknown")
        .Add(DeliveryState.Expired, "expired");

    public static readonly ImmutableArray<string> DisabledReasons = [NotRegistered, OverDeviceLimit];
}
