using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Sacou.Modules.Notifications.Infrastructure;

/// <summary>The Notifications persistence wiring, shared by the API and the design-time factory (ADR 0037).</summary>
internal static class NotificationsDatabase
{
    public const string ConnectionStringName = "Sacou";

    public static IServiceCollection AddNotificationsDatabase(this IServiceCollection services, IConfiguration configuration)
    {
        // Read when the context is built, so a missing value fails the first query, never at composition.
        services.AddDbContext<NotificationsDbContext>(options => Configure(
            options, configuration.GetConnectionString(ConnectionStringName) ?? string.Empty));
        services.AddScoped<INotificationStore, PostgresNotificationStore>();
        services.AddScoped<IPushDeviceStore, PostgresPushDeviceStore>();
        services.AddScoped<IDeliveryStore, PostgresDeliveryStore>();
        return services;
    }

    public static DbContextOptionsBuilder Configure(DbContextOptionsBuilder options, string connectionString) =>
        options.UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable(
            NotificationsDbContext.MigrationsHistoryTable, NotificationsDbContext.Schema));

    public static async Task MigrateAsync(IServiceProvider services, CancellationToken cancellationToken)
    {
        var scope = services.CreateAsyncScope();
        await using (scope.ConfigureAwait(false))
        {
            var database = scope.ServiceProvider.GetRequiredService<NotificationsDbContext>();
            await database.Database.MigrateAsync(cancellationToken).ConfigureAwait(false);
        }
    }
}

/// <summary>
/// Lets <c>dotnet ef migrations add</c> build the context without the API. Never connects: generating
/// a migration only reads the model, so the connection string is a placeholder with no password.
/// </summary>
internal sealed class NotificationsDesignTimeFactory : IDesignTimeDbContextFactory<NotificationsDbContext>
{
    private const string DesignTimeConnection = "Host=localhost;Database=sacou";

    public NotificationsDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<NotificationsDbContext>();
        NotificationsDatabase.Configure(options, DesignTimeConnection);
        return new NotificationsDbContext(options.Options);
    }
}
