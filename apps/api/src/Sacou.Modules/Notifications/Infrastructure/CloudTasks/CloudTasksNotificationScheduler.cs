using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Sacou.Modules.Notifications.Application;

namespace Sacou.Modules.Notifications.Infrastructure.CloudTasks;

/// <summary>
/// Queues one call of <c>POST /internal/notifications/pump</c> per one-minute window (ADR 0069, D10) through the Cloud
/// Tasks REST API, with the runtime account's token from the metadata server. The task carries an OIDC token of the
/// calling account for the service's URL, which the route checks. A task of that window already queued (409) is fine;
/// a window no earlier than one already queued and still ahead is not asked again, since that call schedules the next.
/// </summary>
internal sealed class CloudTasksNotificationScheduler(
    HttpClient client,
    MetadataAccessToken token,
    IOptions<NotificationTasksOptions> options,
    ScheduledWindows windows,
    TimeProvider time,
    ILogger<CloudTasksNotificationScheduler> logger) : INotificationScheduler
{
    public const string HttpClientName = "Sacou.Notifications.CloudTasks";

    public static readonly Uri ApiBase = new("https://cloudtasks.googleapis.com/v2/");

    /// <summary>Short: it runs before a write answers.</summary>
    public static readonly TimeSpan Timeout = TimeSpan.FromSeconds(2);

    public async Task ScheduleAsync(DateTimeOffset dueAt, CancellationToken cancellationToken)
    {
        var settings = options.Value;
        var now = time.GetUtcNow();
        var window = PumpWindow.Of(dueAt, now);
        if (!windows.ShouldAsk(window, now))
        {
            return;
        }

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(ApiBase, settings.QueuePath + "/tasks"))
            {
                Content = JsonContent.Create(Body(settings, window)),
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", await token.GetAsync(cancellationToken).ConfigureAwait(false));
            using var response = await client.SendAsync(request, cancellationToken).ConfigureAwait(false);
            if (response.IsSuccessStatusCode || response.StatusCode == HttpStatusCode.Conflict)
            {
                windows.Asked(window, now);
                NotificationLog.Scheduled(logger, window.TaskId);
                return;
            }

            NotificationLog.ScheduleFailed(logger, ((int)response.StatusCode).ToString(System.Globalization.CultureInfo.InvariantCulture));
        }
        catch (Exception exception) when (exception is HttpRequestException or OperationCanceledException or IOException or System.Text.Json.JsonException)
        {
            // Case E11: the write answers anyway; the daily sweep or the next write pumps what is due.
            NotificationLog.ScheduleFailed(logger, exception.GetType().Name);
        }
    }

    /// <summary>The task of the window: its name, its time, and the call with the calling account's OIDC token.</summary>
    internal static CreateTaskRequest Body(NotificationTasksOptions settings, PumpWindow window)
    {
        ArgumentNullException.ThrowIfNull(settings);
        ArgumentNullException.ThrowIfNull(window);
        var url = new Uri(new Uri(settings.ServiceUrl), NotificationRoutes.InternalPump).AbsoluteUri;
        return new CreateTaskRequest(new CloudTask(
            $"{settings.QueuePath}/tasks/{window.TaskId}",
            window.StartsAt.UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ssZ", System.Globalization.CultureInfo.InvariantCulture),
            new CloudTaskHttpRequest(url, "POST", new CloudTaskOidcToken(settings.InvokerEmail, settings.ServiceUrl))));
    }
}

/// <summary>The windows asked in this process (one instance at most, ADR 0068): saves a call per write.</summary>
internal sealed class ScheduledWindows
{
    private readonly Lock gate = new();

    private DateTimeOffset? earliestAhead;

    public bool ShouldAsk(PumpWindow window, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(window);
        lock (gate)
        {
            return earliestAhead is not { } asked || asked <= now || window.StartsAt < asked;
        }
    }

    public void Asked(PumpWindow window, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(window);
        lock (gate)
        {
            earliestAhead = earliestAhead is { } asked && asked > now && asked < window.StartsAt ? asked : window.StartsAt;
        }
    }
}

internal sealed record CreateTaskRequest([property: JsonPropertyName("task")] CloudTask Task);

internal sealed record CloudTask(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("scheduleTime")] string ScheduleTime,
    [property: JsonPropertyName("httpRequest")] CloudTaskHttpRequest HttpRequest);

internal sealed record CloudTaskHttpRequest(
    [property: JsonPropertyName("url")] string Url,
    [property: JsonPropertyName("httpMethod")] string HttpMethod,
    [property: JsonPropertyName("oidcToken")] CloudTaskOidcToken OidcToken);

internal sealed record CloudTaskOidcToken(
    [property: JsonPropertyName("serviceAccountEmail")] string ServiceAccountEmail,
    [property: JsonPropertyName("audience")] string Audience);
