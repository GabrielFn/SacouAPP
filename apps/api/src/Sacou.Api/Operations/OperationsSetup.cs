using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using Sacou.Modules.Identity;

namespace Sacou.Api.Operations;

/// <summary>
/// The operator's dashboard (E7.2, ADR 0085): the list of operators, checked on start, the policy that answers 404 to
/// anyone else, the cache and the reader of the counts.
/// </summary>
internal static class OperationsSetup
{
    public static IServiceCollection AddSacouOperations(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<OperationsOptions>().Bind(configuration.GetSection(OperationsOptions.SectionName)).ValidateOnStart();
        services.AddSingleton<IValidateOptions<OperationsOptions>, OperationsOptionsValidator>();
        // After the validator: a malformed list throws on start, before this ever runs.
        services.AddSingleton(provider => OperatorSubjects.Parse(provider.GetRequiredService<IOptions<OperationsOptions>>().Value.OperatorSubjects).Value);
        services.AddSingleton<IAuthorizationHandler, OperatorAuthorizationHandler>();
        services.AddSingleton<IAuthorizationMiddlewareResultHandler, OperatorDeniedAsNotFound>();
        services.AddAuthorizationBuilder().AddPolicy(OperatorAccess.Policy, policy => policy
            .AddAuthenticationSchemes(IdentityModule.AuthenticationScheme)
            .RequireAuthenticatedUser()
            .AddRequirements(OperatorRequirement.Instance));
        services.AddSingleton<OpsMetricsCache>();
        services.AddScoped<OpsMetricsReader>();
        return services;
    }

    public static IEndpointRouteBuilder MapSacouOperations(this IEndpointRouteBuilder endpoints) => endpoints.MapOpsMetrics();
}
