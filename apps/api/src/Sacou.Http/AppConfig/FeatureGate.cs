using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Sacou.Http.AppConfig;

/// <summary>The feature flag a route needs to be on, written in its metadata so the gate and the tests can read it.</summary>
public sealed record FeatureRequirement(AppFeature Flag);

/// <summary>
/// <c>RequireFeature</c> (ADR 0084): a route behind a flag answers 404 <c>api.feature-disabled</c> while the flag is off. The
/// gate is a middleware after the authorization and before the group's access filter, so it never reads the database.
/// </summary>
public static class FeatureGate
{
    public static TBuilder RequireFeature<TBuilder>(this TBuilder builder, AppFeature flag)
        where TBuilder : IEndpointConventionBuilder
    {
        ArgumentNullException.ThrowIfNull(builder);
        return builder.WithMetadata(new FeatureRequirement(flag));
    }

    /// <summary>After the authorization (a refused token is still a 401) and before the rate limiter.</summary>
    public static IApplicationBuilder UseSacouFeatureGate(this IApplicationBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);
        return app.Use(async (context, next) =>
        {
            var required = context.GetEndpoint()?.Metadata.GetOrderedMetadata<FeatureRequirement>() ?? [];
            if (required.Count > 0)
            {
                var options = context.RequestServices.GetRequiredService<IOptions<AppConfigOptions>>().Value;
                if (required.Any(requirement => !options.IsOn(requirement.Flag)))
                {
                    await ProblemResults.From(AppConfigErrors.FeatureDisabled).ExecuteAsync(context).ConfigureAwait(false);
                    return;
                }
            }

            await next(context).ConfigureAwait(false);
        });
    }
}
