using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Text;

namespace Sacou.Tests.TestSupport;

/// <summary>Answers HTTP calls with no network and records each request URI.</summary>
internal sealed class StubHttpHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
{
    private readonly ConcurrentQueue<Uri?> requests = new();

    public int RequestCount => requests.Count;

    public IReadOnlyList<Uri?> RequestedUris => [.. requests];

    /// <summary>Held before each answer, so concurrent callers really overlap.</summary>
    public TimeSpan Delay { get; init; } = TimeSpan.Zero;

    public static HttpResponseMessage Json(string body, TimeSpan? maxAge = null, HttpStatusCode status = HttpStatusCode.OK)
    {
        var response = new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        if (maxAge is { } age)
        {
            response.Headers.CacheControl = new CacheControlHeaderValue { Public = true, MaxAge = age };
        }

        return response;
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        requests.Enqueue(request.RequestUri);
        if (Delay > TimeSpan.Zero)
        {
            await Task.Delay(Delay, cancellationToken).ConfigureAwait(false);
        }

        return respond(request);
    }
}
