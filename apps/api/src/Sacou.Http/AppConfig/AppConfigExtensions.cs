using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

namespace Sacou.Http.AppConfig;

public static class AppConfigExtensions
{
    /// <summary>Binds <c>AppConfig</c> and validates it on start (ADR 0084): a bad value stops the deploy, never a request.</summary>
    public static IServiceCollection AddSacouAppConfig(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);
        services.AddOptions<AppConfigOptions>().Bind(configuration.GetSection(AppConfigOptions.SectionName)).ValidateOnStart();
        services.TryAddEnumerable(ServiceDescriptor.Singleton<IValidateOptions<AppConfigOptions>, AppConfigOptionsValidator>());
        return services;
    }
}
