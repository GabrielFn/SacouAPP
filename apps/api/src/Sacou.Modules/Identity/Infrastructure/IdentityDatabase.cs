using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Sacou.Modules.Identity.Infrastructure;

/// <summary>The Identity persistence wiring, shared by the API and the design-time factory (ADR 0037).</summary>
internal static class IdentityDatabase
{
    public const string ConnectionStringName = "Sacou";

    public static IServiceCollection AddIdentityDatabase(this IServiceCollection services, IConfiguration configuration)
    {
        // Read when the context is built, so a missing value fails the first query, never at composition.
        services.AddDbContext<IdentityDbContext>(options => Configure(
            options, configuration.GetConnectionString(ConnectionStringName) ?? string.Empty));
        services.AddScoped<IUserStore, PostgresUserStore>();
        return services;
    }

    public static DbContextOptionsBuilder Configure(DbContextOptionsBuilder options, string connectionString) =>
        options.UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable(
            IdentityDbContext.MigrationsHistoryTable, IdentityDbContext.Schema));

    public static async Task MigrateAsync(IServiceProvider services, CancellationToken cancellationToken)
    {
        var scope = services.CreateAsyncScope();
        await using (scope.ConfigureAwait(false))
        {
            var database = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
            await database.Database.MigrateAsync(cancellationToken).ConfigureAwait(false);
        }
    }
}
