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
/// The per-user limits of the API (ADR 0062): a global fixed window on every signed-in route, chained with a per-user
/// and then one shared concurrency limit for the two-connection routes, and a fixed window per route policy. In memory,
/// one process.
/// </summary>
public static class RateLimitingExtensions
{
    private const string DualConnectionPartition = "dual-connection";

    public static IServiceCollection AddSacouRateLimiting(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        services.AddOptions<RateLimitingOptions>().Bind(configuration.GetSection(RateLimitingOptions.SectionName)).ValidateOnStart();
        services.TryAddEnumerable(ServiceDescriptor.Singleton<IValidateOptions<RateLimitingOptions>, RateLimitingOptionsValidator>());
        // AddRateLimiter only registers the middleware's services; the limiters are built in a Configure that depends on
        // IOptions<RateLimitingOptions>, so they read the bound section (validated on start) when the options are first
        // resolved, not the raw IConfiguration while the services are still being registered.
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
            PartitionedRateLimiter.Create<HttpContext, string>(context => DualConnectionPerUser(context, options)),
            PartitionedRateLimiter.Create<HttpContext, string>(context => DualConnectionGate(context, options)));
        foreach (var policy in windows.Keys.Where(name => name != RateLimitPolicies.Global))
        {
            var window = Required(windows, policy);
            if (RateLimitPolicies.PerClientAddress.Contains(policy))
            {
                limiter.AddPolicy(policy, context => Window(ClientAddressKey.Of(context), window));
            }
            else
            {
                limiter.AddPolicy(policy, context => UserWindow(context, window));
            }
        }
    }

    private static WindowLimitOptions Required(IReadOnlyDictionary<string, WindowLimitOptions?> windows, string policy) =>
        windows[policy] ?? throw new InvalidOperationException($"The rate limit '{policy}' is missing.");

    private static RateLimitPartition<string> UserWindow(HttpContext context, WindowLimitOptions window)
    {
        var key = RateLimitPartitionKey.Of(context.User);
        return key is null ? RateLimitPartition.GetNoLimiter(string.Empty) : Window(key, window);
    }

    private static RateLimitPartition<string> Window(string key, WindowLimitOptions window) =>
        RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = window.PermitLimit,
            Window = window.Window,
            QueueLimit = 0,
            AutoReplenishment = true,
        });

    /// <summary>
    /// Before the shared gate, and acquired first by the chain: the limiters run before the endpoint reads the body, so
    /// without this one an account sending slow bodies could hold every place of the gate. Its waiting requests hold none.
    /// </summary>
    private static RateLimitPartition<string> DualConnectionPerUser(HttpContext context, RateLimitingOptions options)
    {
        var key = IsDualConnection(context) ? RateLimitPartitionKey.Of(context.User) : null;
        return key is null
            ? RateLimitPartition.GetNoLimiter(string.Empty)
            : RateLimitPartition.GetConcurrencyLimiter(key, _ => new ConcurrencyLimiterOptions
            {
                PermitLimit = options.DualConnectionPerUser,
                QueueLimit = options.DualConnectionPerUserQueue,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            });
    }

    /// <summary>One partition for everyone: the two-connection routes together, never per user.</summary>
    private static RateLimitPartition<string> DualConnectionGate(HttpContext context, RateLimitingOptions options) =>
        IsDualConnection(context)
            ? RateLimitPartition.GetConcurrencyLimiter(DualConnectionPartition, _ => new ConcurrencyLimiterOptions
            {
                PermitLimit = options.DualConnectionConcurrency,
                QueueLimit = options.DualConnectionQueue,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            })
            : RateLimitPartition.GetNoLimiter(string.Empty);

    private static bool IsDualConnection(HttpContext context) =>
        context.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName is { } policy
        && RateLimitPolicies.DualConnection.Contains(policy);
}
