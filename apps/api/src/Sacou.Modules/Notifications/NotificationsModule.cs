using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Notifications.AccountData;
using Sacou.Modules.Notifications.Application;
using Sacou.Modules.Notifications.Contracts;
using Sacou.Modules.Notifications.Infrastructure;
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
        // Part 1 of E3.11 sends nothing: the Expo gateway comes with part 2, with its secret.
        services.AddSingleton<IPushGateway, DisabledPushGateway>();
        services.AddScoped<ListNotificationsHandler>();
        services.AddScoped<IAccountErasure, NotificationsAccountErasure>();
        services.AddScoped<IAccountExportSection, NotificationsExportSection>();
        return services;
    }

    /// <summary>Every route is the caller's own, under <c>/v1/me</c>: none has a group id.</summary>
    public static IEndpointRouteBuilder MapNotificationsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapRegisterPushDevice().MapRemovePushDevice().MapListNotifications().MapMarkNotificationsRead();
        return endpoints;
    }

    /// <summary>Applies the Notifications migrations. The API calls it after the Matches ones.</summary>
    public static Task MigrateAsync(IServiceProvider services, CancellationToken cancellationToken = default) =>
        NotificationsDatabase.MigrateAsync(services, cancellationToken);
}
