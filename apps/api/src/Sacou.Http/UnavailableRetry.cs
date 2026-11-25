using System.Globalization;
using Microsoft.AspNetCore.Http;
using Sacou.Shared.Results;

namespace Sacou.Http;

/// <summary>
/// The <c>Retry-After</c> of a business 503 (<see cref="ErrorKind.Unavailable"/>, such as <c>matches.court-busy</c>,
/// ADR 0081): the app waits that long and tries again (ADR 0067, D3). A build of a snapshot takes a few seconds.
/// </summary>
public static class UnavailableRetry
{
    public const int RetryAfterSeconds = 2;

    /// <summary>Sets the header only for an unavailable error; every other answer goes as it is.</summary>
    public static void Apply(HttpResponse response, Error error)
    {
        ArgumentNullException.ThrowIfNull(response);
        ArgumentNullException.ThrowIfNull(error);
        if (error.Kind == ErrorKind.Unavailable)
        {
            response.Headers.RetryAfter = RetryAfterSeconds.ToString(CultureInfo.InvariantCulture);
        }
    }
}
