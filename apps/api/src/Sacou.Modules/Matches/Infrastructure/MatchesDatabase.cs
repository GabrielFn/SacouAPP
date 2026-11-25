using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

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
        // One copy of the snapshots per process, checked against the database on every write (ADR 0081).
        services.AddOptions<CourtStreamCacheOptions>().Bind(configuration.GetSection(CourtStreamCacheOptions.SectionName)).ValidateOnStart();
        services.TryAddEnumerable(ServiceDescriptor.Singleton<IValidateOptions<CourtStreamCacheOptions>, CourtStreamCacheOptionsValidator>());
        services.AddOptions<CourtTransactionOptions>().Bind(configuration.GetSection(CourtTransactionOptions.SectionName)).ValidateOnStart();
        services.TryAddEnumerable(ServiceDescriptor.Singleton<IValidateOptions<CourtTransactionOptions>, CourtTransactionOptionsValidator>());
        services.AddSingleton<ICourtStreamSnapshots, MemoryCourtStreamSnapshots>();
        services.AddScoped<ICourtSnapshotSource, CourtSnapshotReader>();
        services.AddScoped<ICourtStreamStore, PostgresCourtStreamStore>();
        services.AddScoped<ICourtWriterReader, PostgresCourtStreamStore>();
        services.AddScoped<ICourtSessionReader, PostgresCourtSessionReader>();
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
