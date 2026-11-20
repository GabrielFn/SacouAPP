using System.Net;
using Xunit;

namespace Sacou.Api.Tests.Web;

/// <summary>
/// E3.12 Part 3: the shell of <c>/c</c>. No data of the server (the token never reaches it), the Sacou's own preview, and
/// the same headers and CSP as the round page.
/// </summary>
public sealed class InvitePageTests(SacouApiFactory factory) : IClassFixture<SacouApiFactory>
{
    private const string Path = "/c";

    [Fact]
    public async Task Page_IsAShell_WithTheSacouPreview_AndTheScript()
    {
        using var response = await GetAsync(Path);
        var html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("<html lang=\"pt-BR\">", html, StringComparison.Ordinal);
        Assert.Contains("<meta property=\"og:title\" content=\"Convite para um grupo no Sacou\">", html, StringComparison.Ordinal);
        Assert.Contains("<meta property=\"og:url\" content=\"https://sacou.test/c\">", html, StringComparison.Ordinal);
        Assert.Contains($"<script type=\"module\" src=\"{RoundPageFixture.InviteScript}\"></script>", html, StringComparison.Ordinal);
        Assert.Contains("id=\"invite-sign-in\" class=\"answer answer-going\" disabled", html, StringComparison.Ordinal);
        Assert.Contains($"data-firebase-auth-domain=\"{RoundPageFixture.AuthDomain}\"", html, StringComparison.Ordinal);
        Assert.Contains("id=\"sheet\" class=\"sheet-backdrop\" hidden", html, StringComparison.Ordinal);
        Assert.DoesNotContain("data-code", html, StringComparison.Ordinal);
        Assert.DoesNotContain("<script>", html, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Page_HasTheHeadersOfTheRoundPage_NeverStored_AndNoCookie()
    {
        using var response = await GetAsync(Path);

        var csp = Header(response, "Content-Security-Policy");
        Assert.Contains("default-src 'none'", csp, StringComparison.Ordinal);
        Assert.Contains("script-src 'self' https://apis.google.com", csp, StringComparison.Ordinal);
        Assert.Contains($"frame-src https://{RoundPageFixture.AuthDomain}", csp, StringComparison.Ordinal);
        Assert.Contains("frame-ancestors 'none'", csp, StringComparison.Ordinal);
        Assert.DoesNotContain("unsafe", csp, StringComparison.Ordinal);
        Assert.Equal("nosniff", Header(response, "X-Content-Type-Options"));
        Assert.Equal("strict-origin", Header(response, "Referrer-Policy"));
        Assert.Equal("noindex, nofollow", Header(response, "X-Robots-Tag"));
        Assert.Equal("DENY", Header(response, "X-Frame-Options"));
        Assert.Equal("same-origin-allow-popups", Header(response, "Cross-Origin-Opener-Policy"));
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        Assert.False(response.Headers.Contains("Set-Cookie"));
    }

    /// <summary>A token in the query (a link typed by hand) is never reflected: the page is the same shell.</summary>
    [Fact]
    public async Task Query_IsNotReflected_AndAPostIsRefused()
    {
        await using var app = RoundPageFixture.Factory(factory, RoundPageFixture.One(RoundPageFixture.NineOfTwelve()));
        using var client = app.CreateClient();
        using var content = new StringContent("token=x");

        var html = await client.GetStringAsync(new Uri(Path + "?token=ZZTOKEN%3Cscript%3E", UriKind.Relative), TestContext.Current.CancellationToken);
        using var post = await client.PostAsync(new Uri(Path, UriKind.Relative), content, TestContext.Current.CancellationToken);

        Assert.DoesNotContain("ZZTOKEN", html, StringComparison.Ordinal);
        Assert.Contains(post.StatusCode, new[] { HttpStatusCode.Unauthorized, HttpStatusCode.MethodNotAllowed });
    }

    /// <summary>Without the Firebase Web config the page cannot sign in: no script, no button, and a line says so.</summary>
    [Fact]
    public async Task WithoutFirebase_ThereIsNoScriptAndNoButton()
    {
        await using var bare = RoundPageFixture.Factory(factory, RoundPageFixture.One(RoundPageFixture.NineOfTwelve()), withFirebase: false);
        using var client = bare.CreateClient();

        var html = await client.GetStringAsync(new Uri(Path, UriKind.Relative), TestContext.Current.CancellationToken);

        Assert.Contains("O convite pela web não está disponível agora.", html, StringComparison.Ordinal);
        Assert.DoesNotContain("<script", html, StringComparison.Ordinal);
        Assert.DoesNotContain("id=\"invite-sign-in\"", html, StringComparison.Ordinal);
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
