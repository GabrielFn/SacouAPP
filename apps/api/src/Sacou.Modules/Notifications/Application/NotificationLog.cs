using Microsoft.Extensions.Logging;

namespace Sacou.Modules.Notifications.Application;

/// <summary>
/// Everything the Notifications logs: ids of notifications, deliveries and rounds, counts and codes. Never a token, an
/// installation id, a user id, a group name or a venue (docs/seguranca/dados-pessoais.md; case L1 of E3.11).
/// </summary>
internal static partial class NotificationLog
{
    [LoggerMessage(Level = LogLevel.Information, Message = "Notification for round {RoundId}: {Deliveries} deliveries.")]
    public static partial void Requested(ILogger logger, Guid roundId, int deliveries);

    [LoggerMessage(Level = LogLevel.Information, Message = "Notification for round {RoundId} skipped: no active member with an account.")]
    public static partial void NoRecipient(ILogger logger, Guid roundId);

    [LoggerMessage(Level = LogLevel.Information, Message = "Push pump: {Claimed} claimed, {Sent} taken, {Retry} again later, {Failed} failed, {Unknown} unknown.")]
    public static partial void Pumped(ILogger logger, int claimed, int sent, int retry, int failed, int unknown);

    [LoggerMessage(Level = LogLevel.Error, Message = "Push delivery {DeliveryId} failed: {Code}.")]
    public static partial void DeliveryFailed(ILogger logger, Guid deliveryId, string code);

    [LoggerMessage(Level = LogLevel.Information, Message = "Push receipts: {Read} read, {Delivered} delivered, {Failed} failed, {Unknown} unknown.")]
    public static partial void ReceiptsRead(ILogger logger, int read, int delivered, int failed, int unknown);

    /// <summary>Once per process: the name of the setting, never a value.</summary>
    [LoggerMessage(EventId = 6911, EventName = "PushSendingOff", Level = LogLevel.Warning,
        Message = "Push sending is off: SACOU_EXPO_ACCESS_TOKEN is not set. Deliveries stay pending.")]
    public static partial void SendingOff(ILogger logger);

    /// <summary>A category or an HTTP status of the push service, never a body, a header or a token.</summary>
    [LoggerMessage(EventId = 6912, EventName = "PushServiceFailed", Level = LogLevel.Warning, Message = "Push service call {Call} failed: {Category}.")]
    public static partial void ServiceFailed(ILogger logger, string call, string category);

    [LoggerMessage(EventId = 6913, EventName = "PumpScheduleFailed", Level = LogLevel.Warning,
        Message = "Scheduling the next pump failed: {Category}; the daily sweep or the next write catches up.")]
    public static partial void ScheduleFailed(ILogger logger, string category);

    [LoggerMessage(Level = LogLevel.Information, Message = "Next pump scheduled for {TaskId}.")]
    public static partial void Scheduled(ILogger logger, string taskId);

    /// <summary>The type of what failed in one step of the internal route, never its message.</summary>
    [LoggerMessage(EventId = 6914, EventName = "InternalPumpStepFailed", Level = LogLevel.Warning, Message = "Internal pump step {Step} stopped: {Reason}.")]
    public static partial void StepFailed(ILogger logger, string step, string reason);
}
