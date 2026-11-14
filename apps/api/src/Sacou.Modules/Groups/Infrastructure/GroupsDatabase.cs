using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>The Groups persistence wiring, shared by the API and the design-time factory (ADR 0037).</summary>
internal static class GroupsDatabase
{
    public const string ConnectionStringName = "Sacou";

    public static IServiceCollection AddGroupsDatabase(this IServiceCollection services, IConfiguration configuration)
    {
        // Read when the context is built, so a missing value fails the first query, never at composition.
        services.AddDbContext<GroupsDbContext>(options => Configure(
            options, configuration.GetConnectionString(ConnectionStringName) ?? string.Empty));
        services.AddScoped<IGroupStore, PostgresGroupStore>();
        services.AddScoped<IGroupSettingsStore, PostgresGroupSettingsStore>();
        services.AddScoped<IMemberLevelStore, PostgresMemberLevelStore>();
        return services;
    }

    public static DbContextOptionsBuilder Configure(DbContextOptionsBuilder options, string connectionString) =>
        options.UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable(
            GroupsDbContext.MigrationsHistoryTable, GroupsDbContext.Schema));

    public static async Task MigrateAsync(IServiceProvider services, CancellationToken cancellationToken)
    {
        var scope = services.CreateAsyncScope();
        await using (scope.ConfigureAwait(false))
        {
            var database = scope.ServiceProvider.GetRequiredService<GroupsDbContext>();
            await database.Database.MigrateAsync(cancellationToken).ConfigureAwait(false);
        }
    }
}
