using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;
using Sacou.Http.RateLimiting;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Api.Tests.Web;

/// <summary>
/// Case 23: the anonymous page is limited per client address (60 / 60 s), read from the last item of
/// <c>X-Forwarded-For</c> (ADR 0068, D9); the address never reaches a log.
/// </summary>
public sealed class RoundPageLimitTests
{
    private const string Path = "/r/" + RoundPageFixture.Code;
    private const int PermitLimit = 60;

    [Fact]
    public async Task SixtyFirstPageOfOneAddress_Is429_AndAnotherAddressPasses()
    {
        var logs = new CollectingLoggerProvider();
        await using var api = new SacouApiFactory();
        await using var app = RoundPageFixture.Factory(api, RoundPageFixture.One(RoundPageFixture.NineOfTwelve()))
            .WithWebHostBuilder(builder => builder.ConfigureLogging(logging => logging.AddProvider(logs)));
        using var client = app.CreateClient();

        for (var request = 0; request < PermitLimit; request++)
        {
            using var allowed = await GetAsync(client, "9.9.9.9, 203.0.113.7");
            Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
        }

        // Whatever the client writes before the last item is ignored: still the same address.
        using var refused = await GetAsync(client, "1.1.1.1, 203.0.113.7");
        using var other = await GetAsync(client, "203.0.113.7, 198.51.100.9");
        var body = await refused.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
        Assert.True(refused.Headers.Contains("Retry-After"));
        Assert.Equal("no-store", refused.Headers.CacheControl?.ToString());
        Assert.Equal("text/html", refused.Content.Headers.ContentType?.MediaType);
        Assert.Contains("Muitas tentativas", body, StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.OK, other.StatusCode);
        Assert.DoesNotContain(logs.Entries, message => message.Contains("203.0.113.7", StringComparison.Ordinal));
    }

    private static async Task<HttpResponseMessage> GetAsync(HttpClient client, string forwardedFor)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(Path, UriKind.Relative));
        request.Headers.Add(ClientAddressKey.ForwardedFor, forwardedFor);
        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        await response.Content.LoadIntoBufferAsync(TestContext.Current.CancellationToken);
        return response;
    }
}
