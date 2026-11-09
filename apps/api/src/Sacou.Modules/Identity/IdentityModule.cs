using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Sacou.Modules.Identity.Authentication;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Identity.CurrentUsers;
using Sacou.Modules.Identity.Infrastructure;
using Sacou.Modules.Identity.SignIn;

namespace Sacou.Modules.Identity;

/// <summary>Login and users: Firebase ID token check, <c>identity.users</c> and <c>POST /v1/me</c> (ADR 0036, ADR 0037).</summary>
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
        return services;
    }

    public static IEndpointRouteBuilder MapIdentityEndpoints(this IEndpointRouteBuilder endpoints) =>
        endpoints.MapSignIn();

    /// <summary>Applies the Identity migrations. The API calls it when <c>Database:MigrateOnStartup</c> is true.</summary>
    public static Task MigrateAsync(IServiceProvider services, CancellationToken cancellationToken = default) =>
        IdentityDatabase.MigrateAsync(services, cancellationToken);
}
