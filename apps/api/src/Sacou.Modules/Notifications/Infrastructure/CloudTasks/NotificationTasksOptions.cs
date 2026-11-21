using System.Text.RegularExpressions;

namespace Sacou.Modules.Notifications.Infrastructure.CloudTasks;

/// <summary>
/// Where the pump's calls are queued (ADR 0069, D10), section <c>NotificationTasks</c>, none of it secret: the project, the
/// region and the queue of Cloud Tasks, the service's own URL (the target, and the <c>aud</c> of the token) and the account
/// whose OIDC token Cloud Tasks sends. Incomplete, nothing is queued: the next write and the daily sweep pump.
/// </summary>
internal sealed partial class NotificationTasksOptions
{
    public const string SectionName = "NotificationTasks";

    public string Project { get; init; } = string.Empty;

    public string Location { get; init; } = string.Empty;

    public string Queue { get; init; } = string.Empty;

    public string ServiceUrl { get; init; } = string.Empty;

    public string InvokerEmail { get; init; } = string.Empty;

    public bool IsConfigured =>
        GoogleName().IsMatch(Project) && GoogleName().IsMatch(Location) && GoogleName().IsMatch(Queue)
        && Uri.TryCreate(ServiceUrl, UriKind.Absolute, out var url) && url.Scheme == Uri.UriSchemeHttps
        && InvokerEmail.Contains('@', StringComparison.Ordinal);

    /// <summary><c>projects/{project}/locations/{location}/queues/{queue}</c>.</summary>
    public string QueuePath => $"projects/{Project}/locations/{Location}/queues/{Queue}";

    [GeneratedRegex("^[a-z][a-z0-9-]{0,62}$", RegexOptions.CultureInvariant)]
    private static partial Regex GoogleName();
}
