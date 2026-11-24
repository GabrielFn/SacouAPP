using System.Globalization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Net.Http.Headers;

namespace Sacou.Http.RateLimiting;

/// <summary>
/// The 429 (ADR 0062, D5): a <c>ProblemDetails</c> with the fixed title and the <c>code</c>, <c>Retry-After</c> in whole
/// seconds and <c>no-store</c>. Never a detail, the policy's name or the partition key. The log line names the policy only.
/// A page for a person (the round page, ADR 0070, D6) answers with its own short HTML, written by <see cref="IRateLimitedPage"/>.
/// </summary>
internal static partial class RateLimitRejection
{
    public const string Title = "Too many requests";
    public const string Type = "https://www.rfc-editor.org/rfc/rfc6585#section-4";

    /// <summary>The wait when the lease says nothing: the queue of the two-connection routes was full.</summary>
    public const int FallbackRetryAfterSeconds = 1;

    private const string LoggerCategory = "Sacou.Http.RateLimiting";

    public static async ValueTask WriteAsync(OnRejectedContext context, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(context);
        var http = context.HttpContext;
        var logger = http.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger(LoggerCategory);
        var policy = PolicyOf(http);
        LogRefused(logger, policy);
        http.Response.Headers[HeaderNames.RetryAfter] = RetryAfterSeconds(context.Lease).ToString(CultureInfo.InvariantCulture);
        http.Response.Headers[HeaderNames.CacheControl] = NoStore.Value;
        if (RateLimitPolicies.AnswerWithPage.Contains(policy) && http.RequestServices.GetService<IRateLimitedPage>() is { } page)
        {
            http.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            await page.WriteAsync(http, cancellationToken).ConfigureAwait(false);
            return;
        }

        var problem = TypedResults.Problem(
            statusCode: StatusCodes.Status429TooManyRequests,
            title: Title,
            type: Type,
            extensions: new Dictionary<string, object?> { [ProblemResults.CodeExtension] = PipelineErrorCodes.RateLimited });
        await problem.ExecuteAsync(http).ConfigureAwait(false);
    }

    /// <summary>The lease's wait rounded up to whole seconds, at least one.</summary>
    public static int RetryAfterSeconds(RateLimitLease lease)
    {
        ArgumentNullException.ThrowIfNull(lease);
        return lease.TryGetMetadata(MetadataName.RetryAfter, out var wait)
            ? Math.Max(FallbackRetryAfterSeconds, (int)Math.Ceiling(wait.TotalSeconds))
            : FallbackRetryAfterSeconds;
    }

    private static string PolicyOf(HttpContext http) =>
        http.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName ?? RateLimitPolicies.Global;

    [LoggerMessage(Level = LogLevel.Information, Message = "Request refused by the rate limit of {Policy}.")]
    private static partial void LogRefused(ILogger logger, string policy);
}

/// <summary>The body of a 429 on a page a person reads in the browser: short, in pt-BR, with nothing about the limit.</summary>
public interface IRateLimitedPage
{
    Task WriteAsync(HttpContext context, CancellationToken cancellationToken);
}
