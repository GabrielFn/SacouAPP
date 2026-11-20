using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Stats.Access;
using Sacou.Modules.Stats.AccountData;
using Sacou.Modules.Stats.GetMyStats;
using Sacou.Modules.Stats.GetRoundSummary;
using Sacou.Modules.Stats.Infrastructure;
using Sacou.Modules.Stats.Projections;
using Sacou.Modules.Stats.RatingParameters;

namespace Sacou.Modules.Stats;

/// <summary>The projections of the after-game and the hidden rating, in the <c>stats</c> schema (ADR 0071).</summary>
public static class StatsModule
{
    /// <summary>Loads the rating parameters right here: with a corrupt file, the API does not start.</summary>
    public static IServiceCollection AddStatsModule(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        services.TryAddSingleton(TimeProvider.System);
        services.AddSingleton(EmbeddedRatingParams.Load());
        services.AddStatsDatabase(configuration);
        services.AddScoped<StatsProjector>();
        services.AddScoped<RatingProjector>();
        // The person's after-game in the export, never the rating (ADR 0071).
        services.AddScoped<IAccountExportSection, StatsExportSection>();
        return services;
    }

    /// <summary>
    /// The summary of a round behind the Stats' group filter, and the person's own season outside it (on the closed
    /// list of the route guard). Both may replay a stale stream, so both are under <c>court-sync</c>.
    /// </summary>
    public static IEndpointRouteBuilder MapStatsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapStatsRoutes().MapGetRoundSummary();
        endpoints.MapGetMyStats();
        return endpoints;
    }

    /// <summary>Applies the Stats migrations. The API calls it after the Matches ones.</summary>
    public static Task MigrateAsync(IServiceProvider services, CancellationToken cancellationToken = default) =>
        StatsDatabase.MigrateAsync(services, cancellationToken);
}
