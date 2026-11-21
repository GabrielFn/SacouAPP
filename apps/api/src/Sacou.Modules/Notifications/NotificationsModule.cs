using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Notifications.AccountData;
using Sacou.Modules.Notifications.Application;
using Sacou.Modules.Notifications.Contracts;
using Sacou.Modules.Notifications.Infrastructure;
using Sacou.Modules.Notifications.Infrastructure.CloudTasks;
using Sacou.Modules.Notifications.Infrastructure.Expo;
using Sacou.Modules.Notifications.InternalPump;
using Sacou.Modules.Notifications.ListNotifications;
using Sacou.Modules.Notifications.MarkNotificationsRead;
using Sacou.Modules.Notifications.RegisterPushDevice;
using Sacou.Modules.Notifications.RemovePushDevice;

namespace Sacou.Modules.Notifications;

/// <summary>Notifications, the phones that receive them and their deliveries, in the <c>notifications</c> schema (ADR 0069).</summary>
public static class NotificationsModule
{
    /// <summary>
    /// Registered before the Groups: its <see cref="IAccountErasure"/> must run before the Groups' one, which unlinks the
    /// member ids from the account (ADR 0069, D9).
    /// </summary>
    public static IServiceCollection AddNotificationsModule(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        services.TryAddSingleton(TimeProvider.System);
        services.AddNotificationsDatabase(configuration);
        services.AddScoped<Recipients>();
        services.AddScoped<INotificationRequests, NotificationRequestHandler>();
        services.AddScoped<PushMessages>();
        services.AddScoped<INotificationPump, PushPump>();
        services.AddPushService(configuration);
        services.AddScoped<ListNotificationsHandler>();
        services.AddScoped<IAccountErasure, NotificationsAccountErasure>();
        services.AddScoped<IAccountExportSection, NotificationsExportSection>();
        return services;
    }

    /// <summary>The person's routes, under <c>/v1/me</c> (none has a group id), and the internal pump route Google calls.</summary>
    public static IEndpointRouteBuilder MapNotificationsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapRegisterPushDevice().MapRemovePushDevice().MapListNotifications().MapMarkNotificationsRead().MapInternalPump();
        return endpoints;
    }

    /// <summary>
    /// Expo behind the push port, off without <c>SACOU_EXPO_ACCESS_TOKEN</c>; Cloud Tasks behind the scheduler port, a no-op
    /// without its settings (ADR 0069, D10 and D11). Header values never reach the HTTP client logs.
    /// </summary>
    private static void AddPushService(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<ExpoSettings>();
        services.AddHttpClient<ExpoPushGateway>(ExpoPushGateway.HttpClientName, client =>
            {
                client.Timeout = ExpoPushGateway.Timeout;
                client.MaxResponseContentBufferSize = ExpoPushGateway.MaxResponseBytes;
            })
            .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler { AllowAutoRedirect = false, AutomaticDecompression = System.Net.DecompressionMethods.All })
            .RedactLoggedHeaders(_ => true);
        services.AddTransient<IPushGateway>(provider => provider.GetRequiredService<ExpoPushGateway>());

        services.AddOptions<NotificationTasksOptions>().Bind(configuration.GetSection(NotificationTasksOptions.SectionName)).ValidateOnStart();
        services.AddSingleton<IValidateOptions<NotificationTasksOptions>>(new NotificationTasksOptionsValidator(configuration));
        var tasks = configuration.GetSection(NotificationTasksOptions.SectionName).Get<NotificationTasksOptions>() ?? new NotificationTasksOptions();
        if (!tasks.IsConfigured)
        {
            services.AddSingleton<INotificationScheduler, NoopNotificationScheduler>();
            return;
        }

        services.AddSingleton<ScheduledWindows>();
        services.AddHttpClient(MetadataAccessToken.HttpClientName, client => client.Timeout = CloudTasksNotificationScheduler.Timeout)
            .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler { AllowAutoRedirect = false, UseProxy = false })
            .RedactLoggedHeaders(_ => true);
        services.AddSingleton<MetadataAccessToken>();
        services.AddHttpClient<INotificationScheduler, CloudTasksNotificationScheduler>(CloudTasksNotificationScheduler.HttpClientName, client =>
                client.Timeout = CloudTasksNotificationScheduler.Timeout)
            .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler { AllowAutoRedirect = false })
            .RedactLoggedHeaders(_ => true);
    }

    /// <summary>Applies the Notifications migrations. The API calls it after the Matches ones.</summary>
    public static Task MigrateAsync(IServiceProvider services, CancellationToken cancellationToken = default) =>
        NotificationsDatabase.MigrateAsync(services, cancellationToken);
}
