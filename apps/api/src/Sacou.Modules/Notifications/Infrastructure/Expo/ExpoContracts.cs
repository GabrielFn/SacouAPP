using System.Text.Json;
using System.Text.Json.Serialization;

namespace Sacou.Modules.Notifications.Infrastructure.Expo;

/// <summary>
/// One message of <c>POST /--/api/v2/push/send</c>, closed: only these fields go out (ADR 0069, D6). <c>expiration</c> is
/// the round's start in Unix seconds; <c>channelId</c> the Android channel the app creates.
/// </summary>
internal sealed record ExpoMessage(
    [property: JsonPropertyName("to")] string To,
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("body")] string Body,
    [property: JsonPropertyName("data")] ExpoData Data,
    [property: JsonPropertyName("channelId")] string ChannelId,
    [property: JsonPropertyName("priority")] string Priority,
    [property: JsonPropertyName("sound")] string Sound,
    [property: JsonPropertyName("expiration")] long Expiration)
{
    /// <summary>Never prints the token.</summary>
    public override string ToString() => "ExpoMessage";
}

/// <summary>What the app reads when the push is tapped: the kind and three ids, nothing else.</summary>
internal sealed record ExpoData(
    [property: JsonPropertyName("kind")] string Kind,
    [property: JsonPropertyName("notificationId")] Guid NotificationId,
    [property: JsonPropertyName("groupId")] Guid GroupId,
    [property: JsonPropertyName("roundId")] Guid RoundId);

/// <summary>The answer of a send: one ticket per message, in the order sent.</summary>
internal sealed record ExpoSendResponse([property: JsonPropertyName("data")] IReadOnlyList<ExpoTicket>? Data);

internal sealed record ExpoTicket(
    [property: JsonPropertyName("status")] string? Status,
    [property: JsonPropertyName("id")] string? Id,
    [property: JsonPropertyName("details")] ExpoDetails? Details);

internal sealed record ExpoDetails([property: JsonPropertyName("error")] string? Error);

internal sealed record ExpoReceiptsRequest([property: JsonPropertyName("ids")] IReadOnlyList<string> Ids);

/// <summary>The receipts by ticket id; a ticket Expo does not know (yet) is left out.</summary>
internal sealed record ExpoReceiptsResponse([property: JsonPropertyName("data")] IReadOnlyDictionary<string, ExpoReceipt>? Data);

internal sealed record ExpoReceipt(
    [property: JsonPropertyName("status")] string? Status,
    [property: JsonPropertyName("details")] ExpoDetails? Details);

internal static class ExpoJson
{
    /// <summary>Reads the answers leniently (Expo adds fields such as <c>message</c>, never read), writes only the closed records.</summary>
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.Never,
    };
}
