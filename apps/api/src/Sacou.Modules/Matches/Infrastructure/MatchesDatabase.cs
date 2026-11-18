using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Sacou.Modules.Matches.Infrastructure;

/// <summary>The Matches persistence wiring, shared by the API and the design-time factory (ADR 0037).</summary>
internal static class MatchesDatabase
{
    public const string ConnectionStringName = "Sacou";

    public static IServiceCollection AddMatchesDatabase(this IServiceCollection services, IConfiguration configuration)
    {
        // Read when the context is built, so a missing value fails the first query, never at composition.
        services.AddDbContext<MatchesDbContext>(options => Configure(
            options, configuration.GetConnectionString(ConnectionStringName) ?? string.Empty));
        services.AddScoped<ICourtStreamStore, PostgresCourtStreamStore>();
        services.AddScoped<ICourtEventStore, PostgresCourtStreamStore>();
        services.AddScoped<ICourtWriterReader, PostgresCourtStreamStore>();
        return services;
    }

    public static DbContextOptionsBuilder Configure(DbContextOptionsBuilder options, string connectionString) =>
        options.UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable(
            MatchesDbContext.MigrationsHistoryTable, MatchesDbContext.Schema));

    public static async Task MigrateAsync(IServiceProvider services, CancellationToken cancellationToken)
    {
        var scope = services.CreateAsyncScope();
        await using (scope.ConfigureAwait(false))
        {
            var database = scope.ServiceProvider.GetRequiredService<MatchesDbContext>();
            await database.Database.MigrateAsync(cancellationToken).ConfigureAwait(false);
        }
    }
}
