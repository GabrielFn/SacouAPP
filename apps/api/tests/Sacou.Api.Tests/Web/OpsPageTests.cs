using System.Net;
using Xunit;

namespace Sacou.Api.Tests.Web;

/// <summary>Criterion 1 of E7.2: <c>/painel</c> is a shell with no data of the server, with the round page's headers and CSP.</summary>
public sealed class OpsPageTests(SacouApiFactory factory) : IClassFixture<SacouApiFactory>
{
    private const string Path = "/painel";

    [Fact]
    public async Task Page_IsAShell_WithItsScriptAndTheSheet()
    {
        using var response = await GetAsync(Path);
        var html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("<title>Painel do Sacou</title>", html, StringComparison.Ordinal);
        Assert.Contains($"<script type=\"module\" src=\"{RoundPageFixture.OpsScript}\"></script>", html, StringComparison.Ordinal);
        Assert.Contains($"<link rel=\"stylesheet\" href=\"{RoundPageFixture.OpsStyle}\">", html, StringComparison.Ordinal);
        Assert.Contains($"data-firebase-auth-domain=\"{RoundPageFixture.AuthDomain}\"", html, StringComparison.Ordinal);
        Assert.Contains("id=\"sheet\" class=\"sheet-backdrop\" hidden", html, StringComparison.Ordinal);
        Assert.Contains("id=\"ops-sections\"", html, StringComparison.Ordinal);
        Assert.DoesNotContain("<script>", html, StringComparison.Ordinal);
        Assert.Contains("<div id=\"ops-sections\" class=\"ops-sections\" aria-live=\"polite\"></div>", html, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("/painel")]
    [InlineData("/PAINEL")]
    public async Task Page_HasTheHeadersOfTheRoundPage_NeverStored_AndNoCookie(string path)
    {
        using var response = await GetAsync(path);

        var csp = Header(response, "Content-Security-Policy");
        Assert.Contains("default-src 'none'", csp, StringComparison.Ordinal);
        Assert.Contains("script-src 'self' https://apis.google.com", csp, StringComparison.Ordinal);
        Assert.Contains("frame-ancestors 'none'", csp, StringComparison.Ordinal);
        Assert.DoesNotContain("unsafe", csp, StringComparison.Ordinal);
        Assert.DoesNotContain("*", csp, StringComparison.Ordinal);
        Assert.Equal("strict-origin", Header(response, "Referrer-Policy"));
        Assert.Equal("noindex, nofollow", Header(response, "X-Robots-Tag"));
        Assert.Equal("DENY", Header(response, "X-Frame-Options"));
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        Assert.False(response.Headers.Contains("Set-Cookie"));
    }

    [Fact]
    public async Task Query_IsNotReflected_APostIsRefused_AndASubPathHasNoPage()
    {
        await using var app = RoundPageFixture.Factory(factory, RoundPageFixture.One(RoundPageFixture.NineOfTwelve()));
        using var client = app.CreateClient();
        using var content = new StringContent("x=1");

        var html = await client.GetStringAsync(new Uri(Path + "?x=%3Cscript%3EZZMARK", UriKind.Relative), TestContext.Current.CancellationToken);
        using var post = await client.PostAsync(new Uri(Path, UriKind.Relative), content, TestContext.Current.CancellationToken);
        using var below = await client.GetAsync(new Uri(Path + "/qualquer", UriKind.Relative), TestContext.Current.CancellationToken);

        Assert.DoesNotContain("ZZMARK", html, StringComparison.Ordinal);
        Assert.DoesNotContain("<script>", html, StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.Unauthorized, post.StatusCode);
        Assert.NotEqual(HttpStatusCode.OK, below.StatusCode);
    }

    [Fact]
    public async Task WithoutFirebase_ThereIsNoScriptAndNoButton()
    {
        await using var bare = RoundPageFixture.Factory(factory, RoundPageFixture.One(RoundPageFixture.NineOfTwelve()), withFirebase: false);
        using var client = bare.CreateClient();

        var html = await client.GetStringAsync(new Uri(Path, UriKind.Relative), TestContext.Current.CancellationToken);

        Assert.Contains("O painel não está disponível agora", html, StringComparison.Ordinal);
        Assert.DoesNotContain("<script", html, StringComparison.Ordinal);
        Assert.DoesNotContain("id=\"ops-sign-in\"", html, StringComparison.Ordinal);
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
