using System.Collections.Frozen;
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
/// and then one shared concurrency limit for the two-connection routes, the same pair for the <c>court-sync</c> routes
/// (ADR 0081, Part 2), and a fixed window per route policy. In memory, one process.
/// </summary>
public static class RateLimitingExtensions
{
    private const string DualConnectionPartition = "dual-connection";
    private const string CourtSyncPartition = "court-sync";

    private static readonly FrozenSet<string> CourtSyncPolicies = FrozenSet.Create(StringComparer.Ordinal, RateLimitPolicies.CourtSync);

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
            PartitionedRateLimiter.Create<HttpContext, string>(context => PerUser(
                context, RateLimitPolicies.DualConnection, options.DualConnectionPerUser, options.DualConnectionPerUserQueue)),
            PartitionedRateLimiter.Create<HttpContext, string>(context => Gate(
                context, RateLimitPolicies.DualConnection, DualConnectionPartition, options.DualConnectionConcurrency, options.DualConnectionQueue)),
            PartitionedRateLimiter.Create<HttpContext, string>(context => PerUser(
                context, CourtSyncPolicies, options.CourtSyncPerUser, options.CourtSyncPerUserQueue)),
            PartitionedRateLimiter.Create<HttpContext, string>(context => Gate(
                context, CourtSyncPolicies, CourtSyncPartition, options.CourtSyncConcurrency, options.CourtSyncQueue)));
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
    private static RateLimitPartition<string> PerUser(HttpContext context, FrozenSet<string> policies, int permits, int queue)
    {
        var key = HasPolicyIn(context, policies) ? RateLimitPartitionKey.Of(context.User) : null;
        return key is null
            ? RateLimitPartition.GetNoLimiter(string.Empty)
            : RateLimitPartition.GetConcurrencyLimiter(key, _ => Concurrency(permits, queue));
    }

    /// <summary>One partition for everyone: the routes of the class together, never per user.</summary>
    private static RateLimitPartition<string> Gate(HttpContext context, FrozenSet<string> policies, string partition, int permits, int queue) =>
        HasPolicyIn(context, policies)
            ? RateLimitPartition.GetConcurrencyLimiter(partition, _ => Concurrency(permits, queue))
            : RateLimitPartition.GetNoLimiter(string.Empty);

    private static ConcurrencyLimiterOptions Concurrency(int permits, int queue) => new()
    {
        PermitLimit = permits,
        QueueLimit = queue,
        QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
    };

    private static bool HasPolicyIn(HttpContext context, FrozenSet<string> policies) =>
        context.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName is { } policy
        && policies.Contains(policy);
}
