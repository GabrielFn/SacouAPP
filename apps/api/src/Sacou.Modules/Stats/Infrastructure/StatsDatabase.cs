using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Sacou.Modules.Stats.Infrastructure;

/// <summary>The Stats persistence wiring, shared by the API and the design-time factory (ADR 0037).</summary>
internal static class StatsDatabase
{
    public const string ConnectionStringName = "Sacou";

    public static IServiceCollection AddStatsDatabase(this IServiceCollection services, IConfiguration configuration)
    {
        // Read when the context is built, so a missing value fails the first query, never at composition.
        services.AddDbContext<StatsDbContext>(options => Configure(
            options, configuration.GetConnectionString(ConnectionStringName) ?? string.Empty));
        services.AddScoped<IStatsStore, PostgresStatsStore>();
        services.AddScoped<IMvpVoteStore, PostgresMvpVoteStore>();
        services.AddScoped<IMvpResultStore, PostgresMvpResultStore>();
        return services;
    }

    public static DbContextOptionsBuilder Configure(DbContextOptionsBuilder options, string connectionString) =>
        options.UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable(
            StatsDbContext.MigrationsHistoryTable, StatsDbContext.Schema));

    public static async Task MigrateAsync(IServiceProvider services, CancellationToken cancellationToken)
    {
        var scope = services.CreateAsyncScope();
        await using (scope.ConfigureAwait(false))
        {
            var database = scope.ServiceProvider.GetRequiredService<StatsDbContext>();
            await database.Database.MigrateAsync(cancellationToken).ConfigureAwait(false);
        }
    }
}
