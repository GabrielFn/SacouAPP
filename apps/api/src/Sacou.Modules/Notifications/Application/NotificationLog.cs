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
}
