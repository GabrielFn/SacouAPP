using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Matches.Access;
using Sacou.Modules.Matches.AccountData;
using Sacou.Modules.Matches.AppendCourtEvents;
using Sacou.Modules.Matches.Contracts;
using Sacou.Modules.Matches.FormationCatalogs;
using Sacou.Modules.Matches.GetCourtSession;
using Sacou.Modules.Matches.Infrastructure;
using Sacou.Modules.Matches.ListCourtEvents;
using Sacou.Modules.Matches.TakeOverCourt;
using Sacou.Modules.Sessions.Contracts;

namespace Sacou.Modules.Matches;

/// <summary>The court stream, in the <c>matches</c> schema (ADR 0060), its takeover (ADR 0063), and the formation catalog.</summary>
public static class MatchesModule
{
    /// <summary>Loads the catalog right here: with a corrupt one, the API does not start.</summary>
    public static IServiceCollection AddMatchesModule(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        services.TryAddSingleton(TimeProvider.System);
        services.AddSingleton(EmbeddedFormationCatalog.Load());
        services.AddMatchesDatabase(configuration);
        services.AddScoped<AppendCourtEventsHandler>();
        services.AddScoped<CourtStreamNotifier>();
        services.AddScoped<TakeOverCourtHandler>();
        // The after-game of the streams, for the projections of the Stats (E3.9, ADR 0071).
        services.AddScoped<ICourtSessionResults, StoreCourtSessionResults>();
        services.AddScoped<IRoundPlayedMatches, StoreRoundPlayedMatches>();
        // The court batches the person wrote, for the export of the Identity (ADR 0060, D16).
        services.AddScoped<IAccountExportSection, MatchesExportSection>();
        return services;
    }

    /// <summary>
    /// Every route here has a group id, so all of them go through <see cref="CourtRouteExtensions.MapCourtRoutes"/>,
    /// guarded by a test over the whole API.
    /// </summary>
    public static IEndpointRouteBuilder MapMatchesEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapCourtRoutes()
            .MapAppendCourtEvents()
            .MapTakeOverCourt()
            .MapGetCourtSession()
            .MapListCourtEvents();
        return endpoints;
    }

    /// <summary>Applies the Matches migrations. The API calls it after the Sessions ones.</summary>
    public static Task MigrateAsync(IServiceProvider services, CancellationToken cancellationToken = default) =>
        MatchesDatabase.MigrateAsync(services, cancellationToken);
}
