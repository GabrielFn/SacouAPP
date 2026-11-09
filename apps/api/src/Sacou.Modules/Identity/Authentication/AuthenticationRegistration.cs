using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Sacou.Modules.Identity.Authentication;

/// <summary>The Firebase ID token check as the default authentication scheme (ADR 0036, D7 and D8).</summary>
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
            .AddScheme<AuthenticationSchemeOptions, FirebaseAuthenticationHandler>(IdentityModule.AuthenticationScheme, configureOptions: null);
        return services;
    }
}
