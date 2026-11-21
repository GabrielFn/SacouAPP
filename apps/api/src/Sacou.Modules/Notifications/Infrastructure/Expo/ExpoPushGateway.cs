using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using Sacou.Modules.Notifications.Application;

namespace Sacou.Modules.Notifications.Infrastructure.Expo;

/// <summary>
/// The Expo push service (ADR 0069, D5, D6 and D11): <c>/push/send</c> in batches of up to 100 and <c>/push/getReceipts</c>
/// in batches of up to 1,000, with the access token as <c>Authorization: Bearer</c>, 5 s per call and no redirect. Never
/// logs a body, a header, a token or Expo's free text: only the call, a category or a status.
/// </summary>
internal sealed class ExpoPushGateway(HttpClient client, ExpoSettings settings, ILogger<ExpoPushGateway> logger) : IPushGateway
{
    public const string HttpClientName = "Sacou.Notifications.Expo";

    public static readonly Uri BaseAddress = new("https://exp.host/--/api/v2/push/");

    public static readonly TimeSpan Timeout = TimeSpan.FromSeconds(5);

    /// <summary>Answers of 100 tickets or 1,000 receipts are a few tens of KB.</summary>
    public const long MaxResponseBytes = 1024 * 1024;

    private const string SendPath = "send";
    private const string ReceiptsPath = "getReceipts";
    private const string HighPriority = "high";
    private const string DefaultSound = "default";

    public bool IsEnabled => settings.IsConfigured;

    public async Task<IReadOnlyList<PushResult>> SendAsync(IReadOnlyList<PushMessage> messages, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(messages);
        try
        {
            using var request = Post(SendPath, JsonContent.Create(messages.Select(ToExpo).ToList(), options: ExpoJson.Options));
            using var response = await client.SendAsync(request, cancellationToken).ConfigureAwait(false);
            if (response.StatusCode != HttpStatusCode.OK)
            {
                NotificationLog.ServiceFailed(logger, SendPath, ((int)response.StatusCode).ToString(System.Globalization.CultureInfo.InvariantCulture));
                return [.. messages.Select(message => ExpoOutcomes.ClassifyStatus(message.DeliveryId, response.StatusCode))];
            }

            var answer = await response.Content.ReadFromJsonAsync<ExpoSendResponse>(ExpoJson.Options, cancellationToken).ConfigureAwait(false);
            var tickets = answer?.Data ?? [];
            return [.. messages.Select((message, index) => ExpoOutcomes.Classify(message.DeliveryId, index < tickets.Count ? tickets[index] : null))];
        }
        catch (Exception exception) when (exception is HttpRequestException or OperationCanceledException or IOException or System.Text.Json.JsonException)
        {
            var results = messages.Select(message => ExpoOutcomes.ClassifyFailure(message.DeliveryId, exception)).ToList();
            NotificationLog.ServiceFailed(logger, SendPath, results[0].Code ?? ExpoOutcomes.UnknownError);
            return results;
        }
    }

    public async Task<IReadOnlyList<PushReceipt>> GetReceiptsAsync(IReadOnlyList<string> ticketIds, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(ticketIds);
        try
        {
            using var request = Post(ReceiptsPath, JsonContent.Create(new ExpoReceiptsRequest(ticketIds), options: ExpoJson.Options));
            using var response = await client.SendAsync(request, cancellationToken).ConfigureAwait(false);
            if (response.StatusCode != HttpStatusCode.OK)
            {
                NotificationLog.ServiceFailed(logger, ReceiptsPath, ((int)response.StatusCode).ToString(System.Globalization.CultureInfo.InvariantCulture));
                return [];
            }

            var answer = await response.Content.ReadFromJsonAsync<ExpoReceiptsResponse>(ExpoJson.Options, cancellationToken).ConfigureAwait(false);
            var receipts = answer?.Data ?? new Dictionary<string, ExpoReceipt>();
            return [.. ticketIds.Select(id => ExpoOutcomes.ClassifyReceipt(id, receipts.GetValueOrDefault(id))).OfType<PushReceipt>()];
        }
        catch (Exception exception) when (exception is HttpRequestException or OperationCanceledException or IOException or System.Text.Json.JsonException)
        {
            // Read again at the next turn; after a day without one, the delivery counts as unknown.
            NotificationLog.ServiceFailed(logger, ReceiptsPath, ExpoOutcomes.ClassifyFailure(Guid.Empty, exception).Code ?? ExpoOutcomes.UnknownError);
            return [];
        }
    }

    /// <summary>The closed message of ADR 0069, D6. Exposed for the size and shape test (case E8).</summary>
    internal static ExpoMessage ToExpo(PushMessage message)
    {
        ArgumentNullException.ThrowIfNull(message);
        return new ExpoMessage(
            message.To,
            message.Title,
            message.Body,
            new ExpoData(message.Data.Kind, message.Data.NotificationId, message.Data.GroupId, message.Data.RoundId),
            PushMessages.AndroidChannel,
            HighPriority,
            DefaultSound,
            message.Expiration.ToUnixTimeSeconds());
    }

    private HttpRequestMessage Post(string path, HttpContent content)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, new Uri(BaseAddress, path)) { Content = content };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.AccessToken);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        return request;
    }
}
