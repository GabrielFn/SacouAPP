using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Sacou.Modules.Matches.Contracts;
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
        services.AddScoped<ICourtStreamChanged, StatsStreamChanged>();
        return services;
    }

    /// <summary>Applies the Stats migrations. The API calls it after the Matches ones.</summary>
    public static Task MigrateAsync(IServiceProvider services, CancellationToken cancellationToken = default) =>
        StatsDatabase.MigrateAsync(services, cancellationToken);
}
