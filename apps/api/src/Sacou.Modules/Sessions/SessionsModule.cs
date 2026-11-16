using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Sessions.Access;
using Sacou.Modules.Sessions.AccountData;
using Sacou.Modules.Sessions.Application;
using Sacou.Modules.Sessions.CancelRound;
using Sacou.Modules.Sessions.CreateRound;
using Sacou.Modules.Sessions.DrawTeams;
using Sacou.Modules.Sessions.GetRound;
using Sacou.Modules.Sessions.Infrastructure;
using Sacou.Modules.Sessions.ListRounds;
using Sacou.Modules.Sessions.RespondAttendance;
using Sacou.Modules.Sessions.SetMemberAttendance;
using Sacou.Modules.Sessions.StopSeries;
using Sacou.Modules.Sessions.UpdateRound;

namespace Sacou.Modules.Sessions;

/// <summary>Rounds, recurrence, attendance and the waitlist, in the <c>sessions</c> schema (ADR 0043).</summary>
public static class SessionsModule
{
    public static IServiceCollection AddSessionsModule(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        services.TryAddSingleton(TimeProvider.System);
        services.AddSessionsDatabase(configuration);
        services.AddScoped<GroupRoundContext>();
        services.AddScoped<RoundWriter>();
        services.AddScoped<RoundMaterializer>();
        services.AddScoped<CreateRoundHandler>();
        services.AddScoped<ListRoundsHandler>();
        services.AddScoped<GetRoundHandler>();
        services.AddScoped<UpdateRoundHandler>();
        services.AddScoped<CancelRoundHandler>();
        services.AddScoped<RespondAttendanceHandler>();
        services.AddScoped<SetMemberAttendanceHandler>();
        services.AddScoped<StopSeriesHandler>();
        // The person's own attendances, for the export of the Identity (E3.16, ADR 0056, D6).
        services.AddScoped<IAccountAttendanceReader, PostgresAccountAttendanceReader>();
        services.AddScoped<IAccountExportSection, SessionsExportSection>();
        services.AddSingleton<IDrawSeeds, RandomDrawSeeds>();
        services.AddScoped<DrawTeamsHandler>();
        return services;
    }

    /// <summary>
    /// Every route here has a group id, so all of them go through <see cref="RoundRouteExtensions.MapRoundRoutes"/>,
    /// guarded by a test over the whole API.
    /// </summary>
    public static IEndpointRouteBuilder MapSessionsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapRoundRoutes()
            .MapCreateRound()
            .MapListRounds()
            .MapGetRound()
            .MapUpdateRound()
            .MapCancelRound()
            .MapRespondAttendance()
            .MapSetMemberAttendance()
            .MapStopSeries()
            .MapDrawTeams();
        return endpoints;
    }

    /// <summary>Applies the Sessions migrations. The API calls it after the Groups ones.</summary>
    public static Task MigrateAsync(IServiceProvider services, CancellationToken cancellationToken = default) =>
        SessionsDatabase.MigrateAsync(services, cancellationToken);
}
