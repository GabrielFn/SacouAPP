namespace Sacou.Modules.Notifications.Domain;

/// <summary>The numbers of the module (ADR 0069), in one place.</summary>
internal static class NotificationLimits
{
    /// <summary>Active phones per account; a sixth turns the oldest off.</summary>
    public const int MaxActiveDevices = 5;

    /// <summary>Notifications per page of screen 28.</summary>
    public const int PageSize = 20;

    /// <summary>The body of <c>PUT /v1/me/push-devices</c>: an installation id, a token and a platform.</summary>
    public const long MaxDeviceBodyBytes = 1024;

    /// <summary>Messages per call to the push service (Expo takes up to 100).</summary>
    public const int SendBatchSize = 100;

    /// <summary>Tickets per call to the receipts of the push service (Expo takes up to 1,000).</summary>
    public const int ReceiptBatchSize = 1_000;

    /// <summary>Rows per delete of the cleanup, so it never holds a long lock.</summary>
    public const int CleanUpBatchSize = 500;

    /// <summary>How long after a ticket its receipt is read (Expo's advice: about 15 minutes).</summary>
    public static readonly TimeSpan ReceiptDelay = TimeSpan.FromMinutes(15);

    /// <summary>A delivery whose receipt never came by then counts as unknown (Expo keeps receipts about a day).</summary>
    public static readonly TimeSpan ReceiptGiveUp = TimeSpan.FromHours(24);

    /// <summary>A delivery that ended is kept this long, for the record of what happened.</summary>
    public static readonly TimeSpan ClosedDeliveryRetention = TimeSpan.FromDays(7);

    /// <summary>A notification stays on screen 28 this long (docs/dominio/notificacoes.md).</summary>
    public static readonly TimeSpan NotificationRetention = TimeSpan.FromDays(30);

    /// <summary>How long a pump owns a claimed delivery; after that it counts as ambiguous.</summary>
    public static readonly TimeSpan SendingLease = TimeSpan.FromMinutes(2);

    /// <summary>A phone seen again within this time is not written again.</summary>
    public static readonly TimeSpan LastSeenResolution = TimeSpan.FromDays(1);
}
