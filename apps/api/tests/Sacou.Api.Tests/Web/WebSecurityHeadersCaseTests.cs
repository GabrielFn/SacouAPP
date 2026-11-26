using System.Net;
using Xunit;

namespace Sacou.Api.Tests.Web;

/// <summary>
/// M6-B1: routing ignores case, so <c>/R/{code}</c> and <c>/C</c> open the same pages; they get the same headers.
/// </summary>
public sealed class WebSecurityHeadersCaseTests(SacouApiFactory factory) : IClassFixture<SacouApiFactory>
{
    [Theory]
    [InlineData("/R/" + RoundPageFixture.Code)]
    [InlineData("/C")]
    [InlineData("/PAINEL")]
    public async Task UpperCasePath_GetsThePageHeaders(string path)
    {
        using var response = await GetAsync(path);

        var csp = Header(response, "Content-Security-Policy");
        Assert.Contains("default-src 'none'", csp, StringComparison.Ordinal);
        Assert.Contains("frame-ancestors 'none'", csp, StringComparison.Ordinal);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        Assert.Equal("DENY", Header(response, "X-Frame-Options"));
        Assert.Equal("strict-origin", Header(response, "Referrer-Policy"));
        Assert.Equal("noindex, nofollow", Header(response, "X-Robots-Tag"));
    }

    [Theory]
    [InlineData("/R/" + RoundPageFixture.Code)]
    [InlineData("/C")]
    public async Task UpperCasePath_OpensThePage(string path)
    {
        using var response = await GetAsync(path);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private async Task<HttpResponseMessage> GetAsync(string path)
    {
        await using var app = RoundPageFixture.Factory(factory, RoundPageFixture.One(RoundPageFixture.NineOfTwelve()));
        using var client = app.CreateClient();
        var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);
        await response.Content.LoadIntoBufferAsync(TestContext.Current.CancellationToken);
        return response;
    }

    private static string Header(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues(name, out var values) ? string.Join(", ", values) : string.Empty;
}
