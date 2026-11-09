using System.Net;
using Xunit;

namespace Sacou.Api.Tests;

public sealed class HealthEndpointTests(SacouApiFactory factory) : IClassFixture<SacouApiFactory>
{
    /// <summary>C1: the only endpoint open without a token.</summary>
    [Fact]
    public async Task GetHealth_WithoutAToken_ReturnsOk()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/health", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
