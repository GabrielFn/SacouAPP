namespace Sacou.Api.Observability;

/// <summary>
/// <c>GET /dev/fail</c>: a deliberate 500, the acceptance test of Sentry (ADR 0080, D8). Mapped only in Development and
/// Staging, behind the default login (the fallback policy) and the global limit; never in Production.
/// </summary>
internal static class DeliberateFailureEndpoint
{
    internal const string Route = "/dev/fail";

    internal static bool IsMappedIn(IHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(environment);
        return environment.IsDevelopment() || environment.IsStaging();
    }

    internal static IEndpointRouteBuilder MapDeliberateFailure(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet(Route, Fail).ExcludeFromDescription();
        return endpoints;
    }

    private static IResult Fail() => throw new DeliberateFailureException();
}

/// <summary>The exception of <c>/dev/fail</c>: a fixed English message, no data.</summary>
public sealed class DeliberateFailureException : Exception
{
    internal const string FixedMessage = "Deliberate failure to test the error reporting.";

    public DeliberateFailureException()
        : base(FixedMessage)
    {
    }

    public DeliberateFailureException(string message)
        : base(message)
    {
    }

    public DeliberateFailureException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
