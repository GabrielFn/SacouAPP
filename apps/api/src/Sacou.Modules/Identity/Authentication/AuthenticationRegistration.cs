using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Sacou.Modules.Identity.Contracts;

namespace Sacou.Modules.Identity.Authentication;

/// <summary>
/// The Firebase ID token check as the default authentication scheme (ADR 0036, D7 and D8), and the Google OIDC check of
/// the service caller behind <see cref="ServiceCallers.Policy"/> (ADR 0069, D11).
/// </summary>
internal static class AuthenticationRegistration
{
    public static IServiceCollection AddFirebaseAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<FirebaseProjectOptions>()
            .Bind(configuration.GetSection(FirebaseProjectOptions.SectionName))
            .Validate(options => FirebaseProjectOptions.IsValidProjectId(options.ProjectId), FirebaseProjectOptions.InvalidProjectIdMessage)
            .ValidateOnStart();

        services.AddHttpClient(IdentityModule.SigningKeysHttpClientName, client => client.Timeout = GoogleSigningKeyFetcher.Timeout)
            .ConfigurePrimaryHttpMessageHandler(GoogleSigningKeyFetcher.CreatePrimaryHandler);

        services.AddSingleton<GoogleSigningKeyFetcher>();
        services.AddSingleton<ISigningKeySource, GoogleSigningKeySource>();
        services.AddSingleton<IIdTokenVerifier, FirebaseIdTokenVerifier>();

        services.AddAuthentication(IdentityModule.AuthenticationScheme)
            .AddScheme<AuthenticationSchemeOptions, FirebaseAuthenticationHandler>(IdentityModule.AuthenticationScheme, configureOptions: null)
            .AddScheme<AuthenticationSchemeOptions, ServiceCallerAuthenticationHandler>(ServiceCallers.AuthenticationScheme, configureOptions: null);
        services.AddServiceCaller(configuration);
        return services;
    }

    private static void AddServiceCaller(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<ServiceCallerOptions>().Bind(configuration.GetSection(ServiceCallerOptions.SectionName));
        services.AddHttpClient(ServiceCallerSigningKeys.HttpClientName, client => client.Timeout = GoogleSigningKeyFetcher.Timeout)
            .ConfigurePrimaryHttpMessageHandler(GoogleSigningKeyFetcher.CreatePrimaryHandler);
        services.AddSingleton(provider => new ServiceCallerSigningKeys(new GoogleSigningKeySource(
            new GoogleSigningKeyFetcher(provider.GetRequiredService<IHttpClientFactory>(), provider.GetRequiredService<ILogger<GoogleSigningKeyFetcher>>())
            {
                Source = ServiceCallerSigningKeys.KeysUri,
                ClientName = ServiceCallerSigningKeys.HttpClientName,
            },
            provider.GetRequiredService<TimeProvider>(),
            provider.GetRequiredService<ILogger<GoogleSigningKeySource>>())));
        services.AddSingleton(provider => new ServiceCallerTokenVerifier(
            provider.GetRequiredService<ServiceCallerSigningKeys>(),
            provider.GetRequiredService<IOptions<ServiceCallerOptions>>(),
            provider.GetRequiredService<TimeProvider>()));
        // Only its own scheme: a Firebase login never satisfies it, and the default scheme's result is not read.
        services.AddAuthorizationBuilder().AddPolicy(ServiceCallers.Policy, policy => policy
            .AddAuthenticationSchemes(ServiceCallers.AuthenticationScheme)
            .RequireAuthenticatedUser()
            .RequireClaim(System.Security.Claims.ClaimTypes.NameIdentifier, ServiceCallerAuthenticationHandler.Subject));
    }
}
