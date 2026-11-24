using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Sacou.Api.Web.Legal;
using Sacou.Http.RateLimiting;
using Xunit;

namespace Sacou.Api.Tests.Web;

/// <summary>E6.1, cases 6 to 11 and 13: <c>/termos</c> and <c>/privacidade</c>, their headers, and the links of the sign-in sheet.</summary>
public sealed class LegalPageTests(SacouApiFactory factory) : IClassFixture<SacouApiFactory>
{
    private const string Terms = "/termos";
    private const string Privacy = "/privacidade";
    private const string Hostile = "<img src=x onerror=alert(1)>";
    private const int PermitLimit = 60;

    [Theory]
    [InlineData(Terms, "Termos de Uso do Sacou", Privacy)]
    [InlineData(Privacy, "Política de Privacidade do Sacou", Terms)]
    public async Task Page_IsTheRealText_WithVersionAndDate_WithoutSignIn(string path, string title, string otherPath)
    {
        await using var app = App();
        using var client = app.CreateClient();

        using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);
        var html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html; charset=utf-8", response.Content.Headers.ContentType?.ToString());
        Assert.Contains("<html lang=\"pt-BR\">", html, StringComparison.Ordinal);
        Assert.Contains($"<h1>{title}</h1>", html, StringComparison.Ordinal);
        Assert.Contains("Versão 0.1 (rascunho) · atualizada em 24/11/2026", html, StringComparison.Ordinal);
        Assert.Contains($"<a href=\"{otherPath}\">", html, StringComparison.Ordinal);
        Assert.Contains($"<link rel=\"stylesheet\" href=\"{RoundPageFixture.LegalStyle}\">", html, StringComparison.Ordinal);
        Assert.Contains("<main", html, StringComparison.Ordinal);
        Assert.Contains("<article>", html, StringComparison.Ordinal);
        Assert.Contains("<h2>", html, StringComparison.Ordinal);
        Assert.Contains("<ul>", html, StringComparison.Ordinal);
        Assert.DoesNotContain("<script", html, StringComparison.OrdinalIgnoreCase);
        foreach (var note in new[] { "LACUNA", "CONFERIR", "RASCUNHO PARA REVISÃO", "publicar:", "não publicar" })
        {
            Assert.DoesNotContain(note, html, StringComparison.Ordinal);
        }
    }

    [Theory]
    [InlineData(Terms)]
    [InlineData(Privacy)]
    public async Task Page_HasAClosedCsp_WithoutScript_AndIsCheckedAgainOnEachVisit(string path)
    {
        await using var app = App();
        using var client = app.CreateClient();

        using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);

        var csp = Header(response, "Content-Security-Policy");
        Assert.Contains("default-src 'none'", csp, StringComparison.Ordinal);
        Assert.Contains("script-src 'none'", csp, StringComparison.Ordinal);
        Assert.Contains("frame-ancestors 'none'", csp, StringComparison.Ordinal);
        Assert.DoesNotContain("https://", csp, StringComparison.Ordinal);
        Assert.Equal("nosniff", Header(response, "X-Content-Type-Options"));
        Assert.Equal("DENY", Header(response, "X-Frame-Options"));
        Assert.Equal("strict-origin", Header(response, "Referrer-Policy"));
        Assert.Equal("noindex, nofollow", Header(response, "X-Robots-Tag"));
        Assert.Equal("no-cache", response.Headers.CacheControl?.ToString());
        Assert.False(response.Headers.Contains("Set-Cookie"));
    }

    [Fact]
    public async Task Query_IsNotReflected_OtherPaths_Are404_AndPost_IsRefused()
    {
        await using var app = App();
        using var client = app.CreateClient();
        var cancel = TestContext.Current.CancellationToken;

        var html = await client.GetStringAsync(new Uri(Terms + "?x=%3Cscript%3EZZQUERY", UriKind.Relative), cancel);
        using var below = await client.GetAsync(new Uri(Terms + "/x", UriKind.Relative), cancel);
        using var belowPrivacy = await client.GetAsync(new Uri(Privacy + "/x", UriKind.Relative), cancel);
        using var fileName = await client.GetAsync(new Uri("/Terms", UriKind.Relative), cancel);
        using var fileNamePrivacy = await client.GetAsync(new Uri("/Privacy", UriKind.Relative), cancel);
        using var content = new StringContent("x=1");
        using var post = await client.PostAsync(new Uri(Terms, UriKind.Relative), content, cancel);

        Assert.DoesNotContain("ZZQUERY", html, StringComparison.Ordinal);
        // No endpoint under them: the secure-by-default fallback answers before any 404 (ADR 0036, D7), and nothing is drawn.
        foreach (var missing in new[] { below, belowPrivacy, fileName, fileNamePrivacy })
        {
            Assert.Contains(missing.StatusCode, new[] { HttpStatusCode.Unauthorized, HttpStatusCode.NotFound });
            Assert.DoesNotContain("Sacou", await missing.Content.ReadAsStringAsync(cancel), StringComparison.Ordinal);
        }

        Assert.Contains(post.StatusCode, new[] { HttpStatusCode.Unauthorized, HttpStatusCode.MethodNotAllowed });
    }

    [Fact]
    public async Task HostileText_IsEncoded_ThePageDoesNotTrustTheReader()
    {
        var hostile = new LegalDocument(
            Hostile,
            Hostile,
            new DateOnly(2026, 11, 24),
            [new LegalBlock.Heading(2, Hostile), new LegalBlock.Paragraph(Hostile), new LegalBlock.BulletList([Hostile])]);
        await using var app = App(services => services.AddSingleton<ILegalDocuments>(new FakeDocuments(hostile)));
        using var client = app.CreateClient();

        foreach (var path in new[] { Terms, Privacy })
        {
            var html = await client.GetStringAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);

            Assert.DoesNotContain("<img", html, StringComparison.Ordinal);
            Assert.Contains("&lt;img src=x onerror=alert(1)&gt;", html, StringComparison.Ordinal);
        }
    }

    [Theory]
    [InlineData("/r/" + RoundPageFixture.Code)]
    [InlineData("/c")]
    public async Task SignInSheet_LinksTheLegalPages_OnTheSameOrigin(string path)
    {
        await using var app = App();
        using var client = app.CreateClient();

        var html = await client.GetStringAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);

        Assert.Contains($"<a href=\"{Terms}\" rel=\"noopener noreferrer\" target=\"_blank\">Termos</a>", html, StringComparison.Ordinal);
        Assert.Contains(
            $"<a href=\"{Privacy}\" rel=\"noopener noreferrer\" target=\"_blank\">Política de Privacidade</a>", html, StringComparison.Ordinal);
    }

    [Fact]
    public async Task SixtyFirstPageOfOneAddress_Is429_AndAnotherAddressPasses()
    {
        await using var api = new SacouApiFactory();
        await using var app = RoundPageFixture.Factory(api, RoundPageFixture.One(RoundPageFixture.NineOfTwelve()));
        using var client = app.CreateClient();

        for (var request = 0; request < PermitLimit; request++)
        {
            using var allowed = await GetFromAsync(client, Terms, "203.0.113.8");
            Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
        }

        using var refused = await GetFromAsync(client, Privacy, "203.0.113.8");
        using var other = await GetFromAsync(client, Privacy, "198.51.100.10");
        var body = await refused.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
        Assert.True(refused.Headers.Contains("Retry-After"));
        Assert.Contains("Muitas tentativas", body, StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.OK, other.StatusCode);
    }

    [Fact]
    public async Task AnInvalidText_StopsTheStart_WithTheFileAndTheLine()
    {
        const string Invalid = "<!-- publicar:inicio -->\n# Título\nVersão: 0.1\nAtualizada em: 24/11/2026\n<b>ZZSECRET</b>\n<!-- publicar:fim -->";
        await using var app = App(services => services.AddSingleton<ILegalDocumentSource>(new FakeSource(Invalid)));

        var error = Assert.ThrowsAny<Exception>(() => app.CreateClient());

        var message = Flatten(error);
        Assert.Contains(LegalDocuments.TermsFile, message, StringComparison.Ordinal);
        Assert.Contains("line 5", message, StringComparison.Ordinal);
        Assert.DoesNotContain("ZZSECRET", message, StringComparison.Ordinal);
    }

    private WebApplicationFactory<Program> App(Action<IServiceCollection>? replace = null)
    {
        var app = RoundPageFixture.Factory(factory, RoundPageFixture.One(RoundPageFixture.NineOfTwelve()));
        return replace is null ? app : app.WithWebHostBuilder(builder => builder.ConfigureTestServices(replace));
    }

    private static async Task<HttpResponseMessage> GetFromAsync(HttpClient client, string path, string address)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(path, UriKind.Relative));
        request.Headers.Add(ClientAddressKey.ForwardedFor, address);
        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        await response.Content.LoadIntoBufferAsync(TestContext.Current.CancellationToken);
        return response;
    }

    private static string Flatten(Exception error) =>
        error.InnerException is null ? error.Message : error.Message + " | " + Flatten(error.InnerException);

    private static string Header(HttpResponseMessage response, string name) => string.Join(",", response.Headers.GetValues(name));

    private sealed class FakeDocuments(LegalDocument document) : ILegalDocuments
    {
        public LegalDocument Terms => document;

        public LegalDocument Privacy => document;
    }

    private sealed class FakeSource(string content) : ILegalDocumentSource
    {
        public string Read(string fileName) => content;
    }
}
