using Sacou.Modules.Notifications.Contracts;

namespace Sacou.Integration.Tests;

/// <summary>The Notifications' request handler, with a step a test can fail right after it wrote.</summary>
internal sealed class HookedNotificationRequests(INotificationRequests inner, Func<Func<NotificationRequest, Task>?> hook) : INotificationRequests
{
    public async Task RequestAsync(NotificationRequest request, CancellationToken cancellationToken)
    {
        await inner.RequestAsync(request, cancellationToken).ConfigureAwait(false);
        if (hook() is { } after)
        {
            await after(request).ConfigureAwait(false);
        }
    }
}

/// <summary>The Notifications' pump, with a step a test can fail before it runs.</summary>
internal sealed class HookedNotificationPump(INotificationPump inner, Func<Func<Task>?> hook) : INotificationPump
{
    public async Task RunAsync(CancellationToken cancellationToken)
    {
        if (hook() is { } before)
        {
            await before().ConfigureAwait(false);
        }

        await inner.RunAsync(cancellationToken).ConfigureAwait(false);
    }
}
