using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Sacou.Modules.Identity.Authentication;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Identity.CurrentUsers;
using Sacou.Modules.Identity.DeleteMyAccount;
using Sacou.Modules.Identity.ExportMyData;
using Sacou.Modules.Identity.GetDeletionBlockers;
using Sacou.Modules.Identity.GetMyProfile;
using Sacou.Modules.Identity.Infrastructure;
using Sacou.Modules.Identity.Metrics;
using Sacou.Modules.Identity.SaveMyProfile;
using Sacou.Modules.Identity.SignIn;

namespace Sacou.Modules.Identity;

/// <summary>
/// Login, users and profiles: Firebase ID token check, <c>identity.users</c>, <c>POST /v1/me</c> (ADR 0036, ADR 0037)
/// the person's profile, <c>/v1/me/profile</c> (ADR 0051), and the person's own data: the export and what blocks the
/// deletion, and the deletion itself (E3.16, ADR 0056), whose sections and erasures the other modules add through
/// <see cref="IAccountExportSection"/> and <see cref="IAccountErasure"/>.
/// </summary>
public static class IdentityModule
{
    /// <summary>The default authentication scheme of the API.</summary>
    public const string AuthenticationScheme = "Firebase";

    /// <summary>The client that fetches the Google signing keys. Public so a test can replace its handler.</summary>
    public const string SigningKeysHttpClientName = "Sacou.Identity.SigningKeys";

    public static IServiceCollection AddIdentityModule(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        services.TryAddSingleton(TimeProvider.System);
        services.AddFirebaseAuthentication(configuration);
        services.AddIdentityDatabase(configuration);
        services.AddScoped<SignInHandler>();
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, HttpCurrentUser>();
        services.AddScoped<IRegisteredUsers, StoreRegisteredUsers>();
        services.AddScoped<SaveMyProfileHandler>();
        services.AddScoped<IPlayerProfiles, StorePlayerProfiles>();
        services.AddScoped<ExportMyDataHandler>();
        services.AddScoped<GetDeletionBlockersHandler>();
        services.AddScoped<DeleteMyAccountHandler>();
        services.AddScoped<IAccountExportSection, AccountExportSection>();
        services.AddScoped<IAccountExportSection, ProfileExportSection>();
        // The operator's counts (E7.2, ADR 0085, D2).
        services.AddScoped<IIdentityMetrics, PostgresIdentityMetrics>();
        return services;
    }

    public static IEndpointRouteBuilder MapIdentityEndpoints(this IEndpointRouteBuilder endpoints) =>
        endpoints.MapSignIn().MapGetMyProfile().MapSaveMyProfile().MapExportMyData().MapGetDeletionBlockers()
            .MapDeleteMyAccount();

    /// <summary>Applies the Identity migrations. The API calls it when <c>Database:MigrateOnStartup</c> is true.</summary>
    public static Task MigrateAsync(IServiceProvider services, CancellationToken cancellationToken = default) =>
        IdentityDatabase.MigrateAsync(services, cancellationToken);
}
