using System.Net;
using Sacou.Modules.Sessions.Contracts;
using Xunit;

namespace Sacou.Api.Tests.Web;

/// <summary>E3.12 Part 2, cases 24 to 30: the HTML of <c>/r/{code}</c>, its preview, its encoding and its headers.</summary>
public sealed class RoundPageTests(SacouApiFactory factory) : IClassFixture<SacouApiFactory>
{
    private const string Path = "/r/" + RoundPageFixture.Code;

    [Fact]
    public async Task Page_HasThePreview_WithoutAnyName()
    {
        var html = await PageAsync(RoundPageFixture.NineOfTwelve());

        Assert.Contains("<html lang=\"pt-BR\">", html, StringComparison.Ordinal);
        Assert.Contains("<meta property=\"og:title\" content=\"Vôlei de quinta\">", html, StringComparison.Ordinal);
        Assert.Contains(
            "<meta property=\"og:description\" content=\"Qui, 5/11 · 19h · Arena Beira-Mar · 9/12 confirmados\">", html, StringComparison.Ordinal);
        Assert.Contains($"<meta property=\"og:url\" content=\"https://sacou.test/r/{RoundPageFixture.Code}\">", html, StringComparison.Ordinal);
        Assert.Contains("<meta property=\"og:image\" content=\"https://sacou.test/brand/og-image.png\">", html, StringComparison.Ordinal);
        Assert.Contains("<meta name=\"robots\" content=\"noindex, nofollow\">", html, StringComparison.Ordinal);
        Assert.Contains("<meta name=\"twitter:card\" content=\"summary_large_image\">", html, StringComparison.Ordinal);
        Assert.DoesNotContain("ZZNICK", Head(html), StringComparison.Ordinal);
    }

    /// <summary>Question 126, option 2 (19/11/2026): the first names on the page, the mensalistas first, as screen 01.</summary>
    [Fact]
    public async Task Page_ListsTheFirstNames_MensalistasThenAvulsos_AndTheOpenSpots()
    {
        var html = await PageAsync(RoundPageFixture.NineOfTwelve());

        var regulars = html.IndexOf("Mensalistas", StringComparison.Ordinal);
        var dropIns = html.IndexOf("Avulsos", StringComparison.Ordinal);
        Assert.True(regulars > 0 && dropIns > regulars);
        Assert.True(html.IndexOf("ZZNICK6", StringComparison.Ordinal) < dropIns);
        Assert.True(html.IndexOf("ZZNICK7", StringComparison.Ordinal) > dropIns);
        Assert.Contains("3 de 6 vagas", html, StringComparison.Ordinal);
        Assert.Equal(3, Count(html, "vaga aberta"));
        Assert.Contains("Faltam 3. Chama o pessoal!", html, StringComparison.Ordinal);
        Assert.Contains("6x6 · 25 pts · quem perde sai", html, StringComparison.Ordinal);
    }

    /// <summary>Case 25: no id of any kind on the anonymous page; the code only where the script needs it.</summary>
    [Fact]
    public async Task Page_HasNoIdOfAMemberGroupOrRound()
    {
        var html = await PageAsync(RoundPageFixture.NineOfTwelve());

        Assert.DoesNotMatch(@"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", html);
        Assert.Contains($"data-code=\"{RoundPageFixture.Code}\"", html, StringComparison.Ordinal);
    }

    /// <summary>Case 26: the group's name, the place and a nickname are text, in the body and in the attributes.</summary>
    [Fact]
    public async Task Page_EncodesFreeText_InTheBodyAndInTheAttributes()
    {
        var hostile = RoundPageFixture.NineOfTwelve("\"><script>alert(1)</script>", "\" onload=\"x") with
        {
            Going = [new PublicListEntry("<img src=x onerror=alert(2)>", Regular: false)],
        };

        var html = await PageAsync(hostile);

        Assert.DoesNotContain("<script>alert", html, StringComparison.Ordinal);
        Assert.DoesNotContain("<img src=x", html, StringComparison.Ordinal);
        Assert.DoesNotContain("\" onload=\"x", html, StringComparison.Ordinal);
        Assert.Contains("&quot;&gt;&lt;script&gt;", html, StringComparison.Ordinal);
        Assert.Contains("&lt;img src=x onerror=alert(2)&gt;", html, StringComparison.Ordinal);
    }

    /// <summary>Case 27: the headers of the page, and never a cookie.</summary>
    [Fact]
    public async Task Page_HasTheSecurityHeaders_AndNoCookie()
    {
        using var response = await GetAsync(RoundPageFixture.NineOfTwelve(), Path);

        var csp = Header(response, "Content-Security-Policy");
        Assert.Contains("default-src 'none'", csp, StringComparison.Ordinal);
        Assert.Contains("script-src 'self' https://apis.google.com", csp, StringComparison.Ordinal);
        Assert.Contains($"frame-src https://{RoundPageFixture.AuthDomain} https://accounts.google.com", csp, StringComparison.Ordinal);
        Assert.Contains("frame-ancestors 'none'", csp, StringComparison.Ordinal);
        Assert.Contains("form-action 'none'", csp, StringComparison.Ordinal);
        Assert.DoesNotContain("unsafe", csp, StringComparison.Ordinal);
        Assert.Equal("nosniff", Header(response, "X-Content-Type-Options"));
        Assert.Equal("no-referrer", Header(response, "Referrer-Policy"));
        Assert.Equal("noindex, nofollow", Header(response, "X-Robots-Tag"));
        Assert.Equal("same-origin-allow-popups", Header(response, "Cross-Origin-Opener-Policy"));
        Assert.Equal("no-cache, private", response.Headers.CacheControl?.ToString());
        Assert.False(response.Headers.Contains("Set-Cookie"));
    }

    /// <summary>Cases 2 and 3 on the page: a malformed code and one of no round give the same 404, without the code.</summary>
    [Theory]
    [InlineData("/r/short")]
    [InlineData("/r/" + RoundPageFixture.OtherCode)]
    [InlineData("/r/%3Cscript%3Ealert(1)%3C%2Fscript%3E")]
    public async Task UnknownCode_IsTheSame404_WithoutEchoingIt(string path)
    {
        using var response = await GetAsync(RoundPageFixture.NineOfTwelve(), path);
        var html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Contains("Link inválido ou desativado.", html, StringComparison.Ordinal);
        Assert.DoesNotContain("<script>alert", html, StringComparison.Ordinal);
        Assert.DoesNotContain(RoundPageFixture.OtherCode, html, StringComparison.Ordinal);
        Assert.DoesNotContain("og:title", html, StringComparison.Ordinal);
        Assert.NotNull(response.Headers.GetValues("Content-Security-Policy"));
    }

    /// <summary>
    /// Case 28: no handler for POST, and the query is never reflected. The page takes GET and HEAD only, so a POST finds no
    /// anonymous endpoint: the fallback policy answers 401 before the routing's 405, and nothing is rendered.
    /// </summary>
    [Fact]
    public async Task Post_IsRefused_AndTheQueryIsNotReflected()
    {
        await using var app = RoundPageFixture.Factory(factory, RoundPageFixture.One(RoundPageFixture.NineOfTwelve()));
        using var client = app.CreateClient();
        using var content = new StringContent("response=going");

        using var post = await client.PostAsync(new Uri(Path, UriKind.Relative), content, TestContext.Current.CancellationToken);
        var html = await client.GetStringAsync(new Uri(Path + "?x=%3Cscript%3EZZQUERY", UriKind.Relative), TestContext.Current.CancellationToken);

        var postBody = await post.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Assert.Contains(post.StatusCode, new[] { HttpStatusCode.Unauthorized, HttpStatusCode.MethodNotAllowed });
        Assert.DoesNotContain("ZZNICK", postBody, StringComparison.Ordinal);
        Assert.DoesNotContain("ZZQUERY", html, StringComparison.Ordinal);
    }

    /// <summary>Case 24: the full, started and canceled rounds; the closed ones without VOU and without the code.</summary>
    [Fact]
    public async Task FullStartedAndCanceled_SayIt_AndOnlyTheOpenOnesHaveVou()
    {
        var full = RoundPageFixture.NineOfTwelve() with { State = PublicRoundState.Full, GoingCount = 12 };
        var started = RoundPageFixture.NineOfTwelve() with { State = PublicRoundState.Started };
        var canceled = RoundPageFixture.NineOfTwelve() with { State = PublicRoundState.Canceled };

        var fullHtml = await PageAsync(full);
        var startedHtml = await PageAsync(started);
        var canceledHtml = await PageAsync(canceled);

        Assert.Contains("Lotou. Se você for, entra na espera.", fullHtml, StringComparison.Ordinal);
        Assert.Contains("id=\"answer-going\"", fullHtml, StringComparison.Ordinal);
        Assert.Contains("Essa rodada já começou.", startedHtml, StringComparison.Ordinal);
        Assert.Contains("Rodada cancelada.", canceledHtml, StringComparison.Ordinal);
        Assert.Contains("og:description\" content=\"Qui, 5/11 · 19h · Arena Beira-Mar · Rodada cancelada\"", canceledHtml, StringComparison.Ordinal);
        Assert.All([startedHtml, canceledHtml], html =>
        {
            Assert.DoesNotContain("id=\"answer-going\"", html, StringComparison.Ordinal);
            Assert.Contains("data-code=\"\"", html, StringComparison.Ordinal);
        });
    }

    /// <summary>Case 29: the round's own local day, never the UTC one (23h30 in São Paulo is the next day in UTC).</summary>
    [Fact]
    public async Task LateRound_ShowsItsLocalDay()
    {
        var late = RoundPageFixture.NineOfTwelve() with { LocalTime = "23:30", StartsAt = new DateTimeOffset(2026, 11, 6, 2, 30, 0, TimeSpan.Zero) };

        var html = await PageAsync(late);

        Assert.Contains("Qui, 5/11 · 23h30 · Arena Beira-Mar", html, StringComparison.Ordinal);
    }

    /// <summary>Case 30: without JS the summary is there, VOU is off and a line says why; without the Firebase config no VOU.</summary>
    [Fact]
    public async Task WithoutScript_TheButtonsAreOff_AndWithoutFirebaseThereAreNone()
    {
        var html = await PageAsync(RoundPageFixture.NineOfTwelve());
        await using var bare = RoundPageFixture.Factory(factory, RoundPageFixture.One(RoundPageFixture.NineOfTwelve()), withFirebase: false);
        using var client = bare.CreateClient();
        var readOnly = await client.GetStringAsync(new Uri(Path, UriKind.Relative), TestContext.Current.CancellationToken);

        Assert.Contains("id=\"answer-going\" class=\"answer answer-going\" disabled", html, StringComparison.Ordinal);
        Assert.Contains("<noscript><p class=\"notice\">Ative o JavaScript para confirmar.</p></noscript>", html, StringComparison.Ordinal);
        Assert.Contains($"<script type=\"module\" src=\"{RoundPageFixture.Script}\"></script>", html, StringComparison.Ordinal);
        Assert.DoesNotContain("id=\"answer-going\"", readOnly, StringComparison.Ordinal);
        Assert.Contains("data-code=\"\"", readOnly, StringComparison.Ordinal);
        Assert.Contains("ZZNICK1", readOnly, StringComparison.Ordinal);
    }

    private async Task<string> PageAsync(PublicRoundSummary summary)
    {
        using var response = await GetAsync(summary, Path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
    }

    private async Task<HttpResponseMessage> GetAsync(PublicRoundSummary summary, string path)
    {
        await using var app = RoundPageFixture.Factory(factory, RoundPageFixture.One(summary));
        using var client = app.CreateClient();
        var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);
        await response.Content.LoadIntoBufferAsync(TestContext.Current.CancellationToken);
        return response;
    }

    private static string Head(string html) => html[..html.IndexOf("</head>", StringComparison.Ordinal)];

    private static int Count(string text, string value) =>
        (text.Length - text.Replace(value, string.Empty, StringComparison.Ordinal).Length) / value.Length;

    private static string Header(HttpResponseMessage response, string name) => string.Join(",", response.Headers.GetValues(name));
}
