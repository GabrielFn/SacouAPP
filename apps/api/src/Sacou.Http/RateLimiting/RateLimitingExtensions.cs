using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

namespace Sacou.Http.RateLimiting;

/// <summary>
/// The per-user limits of the API (ADR 0062): a global fixed window on every signed-in route, chained with one
/// shared concurrency limit for the two-connection routes, and a fixed window per route policy. In memory, one process.
/// </summary>
public static class RateLimitingExtensions
{
    private const string DualConnectionPartition = "dual-connection";

    public static IServiceCollection AddSacouRateLimiting(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        services.AddOptions<RateLimitingOptions>().Bind(configuration.GetSection(RateLimitingOptions.SectionName)).ValidateOnStart();
        services.TryAddEnumerable(ServiceDescriptor.Singleton<IValidateOptions<RateLimitingOptions>, RateLimitingOptionsValidator>());
        services.AddRateLimiter(_ => { });
        services.AddOptions<RateLimiterOptions>()
            .Configure<IOptions<RateLimitingOptions>>((limiter, sacou) => Configure(limiter, sacou.Value));
        return services;
    }

    /// <summary>After the authentication and the authorization: a 401 or a 403 of the pipeline never spends the quota (D2).</summary>
    public static IApplicationBuilder UseSacouRateLimiting(this IApplicationBuilder app) => app.UseRateLimiter();

    private static void Configure(RateLimiterOptions limiter, RateLimitingOptions options)
    {
        limiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
        limiter.OnRejected = RateLimitRejection.WriteAsync;
        var windows = options.Windows();
        limiter.GlobalLimiter = PartitionedRateLimiter.CreateChained(
            PartitionedRateLimiter.Create<HttpContext, string>(context => UserWindow(context, Required(windows, RateLimitPolicies.Global))),
            PartitionedRateLimiter.Create<HttpContext, string>(context => DualConnectionGate(context, options)));
        foreach (var policy in windows.Keys.Where(name => name != RateLimitPolicies.Global))
        {
            var window = Required(windows, policy);
            limiter.AddPolicy(policy, context => UserWindow(context, window));
        }
    }

    private static WindowLimitOptions Required(IReadOnlyDictionary<string, WindowLimitOptions?> windows, string policy) =>
        windows[policy] ?? throw new InvalidOperationException($"The rate limit '{policy}' is missing.");

    private static RateLimitPartition<string> UserWindow(HttpContext context, WindowLimitOptions window)
    {
        var key = RateLimitPartitionKey.Of(context.User);
        return key is null
            ? RateLimitPartition.GetNoLimiter(string.Empty)
            : RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = window.PermitLimit,
                Window = window.Window,
                QueueLimit = 0,
                AutoReplenishment = true,
            });
    }

    /// <summary>One partition for everyone: the two-connection routes together, never per user.</summary>
    private static RateLimitPartition<string> DualConnectionGate(HttpContext context, RateLimitingOptions options)
    {
        var policy = context.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName;
        return policy is not null && RateLimitPolicies.DualConnection.Contains(policy)
            ? RateLimitPartition.GetConcurrencyLimiter(DualConnectionPartition, _ => new ConcurrencyLimiterOptions
            {
                PermitLimit = options.DualConnectionConcurrency,
                QueueLimit = options.DualConnectionQueue,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            })
            : RateLimitPartition.GetNoLimiter(string.Empty);
    }
}
