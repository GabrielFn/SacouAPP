using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Sacou.Modules.Identity.Contracts;

namespace Sacou.Modules.Notifications.Infrastructure.CloudTasks;

/// <summary>
/// The sender and the receiver of the pump's calls must agree (ADR 0069, D11): the <c>aud</c> and the account Cloud Tasks
/// puts in the token are <c>NotificationTasks:ServiceUrl</c> and <c>NotificationTasks:InvokerEmail</c>, and the route
/// accepts only <c>ServiceCaller:Audience</c> and <c>ServiceCaller:Email</c>. When both sides are set and differ, every
/// task would get a silent 401, so the API refuses to start, naming the keys and never the values.
/// </summary>
internal sealed class NotificationTasksOptionsValidator(IConfiguration configuration) : IValidateOptions<NotificationTasksOptions>
{
    private const string ServiceUrlKey = NotificationTasksOptions.SectionName + ":" + nameof(NotificationTasksOptions.ServiceUrl);
    private const string InvokerEmailKey = NotificationTasksOptions.SectionName + ":" + nameof(NotificationTasksOptions.InvokerEmail);

    public ValidateOptionsResult Validate(string? name, NotificationTasksOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        var failures = new[]
            {
                Mismatch(options.ServiceUrl, ServiceUrlKey, ServiceCallers.AudienceKey),
                Mismatch(options.InvokerEmail, InvokerEmailKey, ServiceCallers.EmailKey),
            }
            .OfType<string>()
            .ToList();
        return failures.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(failures);
    }

    private string? Mismatch(string sent, string sentKey, string acceptedKey)
    {
        var accepted = configuration[acceptedKey];
        return string.IsNullOrWhiteSpace(sent) || string.IsNullOrWhiteSpace(accepted) || string.Equals(sent, accepted, StringComparison.Ordinal)
            ? null
            : $"{sentKey} must be equal to {acceptedKey}, or every call of Cloud Tasks is refused with 401.";
    }
}
