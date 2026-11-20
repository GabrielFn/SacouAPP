namespace Sacou.Modules.Notifications.Domain;

/// <summary>One delivery of one notification to one phone (ADR 0069, D5). The table of moves is <see cref="DeliveryRules"/>.</summary>
internal enum DeliveryState
{
    /// <summary>Waiting for its turn (<c>next_attempt_at</c>).</summary>
    Pending,

    /// <summary>Claimed by one pump, under a lease: no other pump takes it.</summary>
    Sending,

    /// <summary>The push service took it and gave a ticket; the receipt is due later.</summary>
    Sent,

    /// <summary>The receipt said the phone's service took it.</summary>
    Delivered,

    /// <summary>Surely not delivered, and never tried again.</summary>
    Failed,

    /// <summary>Maybe delivered (an ambiguous answer, a pump that died): never tried again, so never twice.</summary>
    Unknown,

    /// <summary>The round started before it went: too late to matter.</summary>
    Expired,
}
