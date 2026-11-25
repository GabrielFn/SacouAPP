using System.Data.Common;
using System.Diagnostics;
using Sacou.Http;
using Sacou.Http.RateLimiting;
using Sacou.Shared.Results;

namespace Sacou.Api.Operations;

/// <summary>
/// <c>GET /v1/ops/metrics</c> (E7.2, ADR 0085): the operator's counts, behind <see cref="OperatorAccess.Policy"/>, the
/// <c>ops</c> limit per user and <c>no-store</c>. No body, no query (a query is refused, never read). Out of the app's
/// contract (ADR 0042): only the dashboard's own script reads it. A count that fails or runs out of time is a 503.
/// </summary>
internal static class OpsMetricsEndpoint
{
    public const string Route = "/v1/ops/metrics";

    public static readonly Error QueryRefused = new("ops.query-refused", ErrorKind.Validation);

    public static readonly Error Unavailable = new("ops.unavailable", ErrorKind.Unavailable);

    public static IEndpointRouteBuilder MapOpsMetrics(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet(Route, HandleAsync)
            .RequireAuthorization(OperatorAccess.Policy)
            .RequireRateLimiting(RateLimitPolicies.Ops)
            .WithNoStore()
            .ExcludeFromDescription();
        return endpoints;
    }

    private static async Task<IResult> HandleAsync(
        HttpContext context,
        OpsMetricsReader reader,
        OpsMetricsCache cache,
        ILogger<OpsMetricsReader> logger,
        CancellationToken cancellationToken)
    {
        if (context.Request.QueryString.HasValue)
        {
            return ProblemResults.From(QueryRefused);
        }

        var started = Stopwatch.GetTimestamp();
        try
        {
            var answer = await cache.GetAsync(reader.ReadAsync, cancellationToken).ConfigureAwait(false);
            var elapsed = (long)Stopwatch.GetElapsedTime(started).TotalMilliseconds;
            OpsLog.Served(logger, elapsed, answer.Cached);
            return TypedResults.Ok(answer.Value);
        }
        catch (DbException exception)
        {
            return Unreachable(logger, exception);
        }
        catch (InvalidOperationException exception) when (exception.InnerException is DbException)
        {
            // The execution strategy of Npgsql wraps a failure it takes for transient (a timeout, a refused connection).
            return Unreachable(logger, exception.InnerException);
        }
    }

    private static Microsoft.AspNetCore.Http.HttpResults.ProblemHttpResult Unreachable(ILogger logger, Exception exception)
    {
        OpsLog.Unavailable(logger, exception.GetType().Name);
        return ProblemResults.From(Unavailable);
    }
}
