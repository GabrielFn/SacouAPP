using System.Net;
using Xunit;

namespace Sacou.Api.Tests.Operations;

/// <summary>Criterion 14 of E7.2: 20 requests a minute per user; the 21st is a 429 with <c>Retry-After</c>.</summary>
public sealed class OpsRateLimitTests
{
    private const int Limit = 20;

    [Fact]
    public async Task TheTwentyFirstRequest_Is429()
    {
        await using var host = new OpsHost("uid-operador-abc");
        using var client = host.CreateClient();

        for (var request = 1; request <= Limit; request++)
        {
            using var allowed = OpsHost.Get("uid-operador-abc");
            using var response = await client.SendAsync(allowed, TestContext.Current.CancellationToken);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        using var over = OpsHost.Get("uid-operador-abc");
        using var refused = await client.SendAsync(over, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
        Assert.NotNull(refused.Headers.RetryAfter);
    }
}
