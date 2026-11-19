using System.Net;
using System.Text.RegularExpressions;
using Sacou.Modules.Sessions.Contracts;
using Xunit;

namespace Sacou.Api.Tests.Web;

/// <summary>E3.12 Part 2, tester: hostile free text in every spot of the page and the preview, and the 404 that tells nothing.</summary>
public sealed class RoundPageHostileTextTests(SacouApiFactory factory) : IClassFixture<SacouApiFactory>
{
    private const string Path = "/r/" + RoundPageFixture.Code;

    [Theory]
    [InlineData("\"><script>alert(1)</script>")]
    [InlineData("' onmouseover='alert(1)")]
    [InlineData("<svg/onload=alert(1)>&amp;")]
    public async Task HostileVenueAndGroup_NeverBreakOutOfTheMetaContent(string hostile)
    {
        var summary = RoundPageFixture.NineOfTwelve(hostile, hostile) with
        {
            Going = [new PublicListEntry(hostile, Regular: true), new PublicListEntry(hostile, Regular: false)],
        };

        var html = await GetHtmlAsync(Path, summary);

        // Every og:/twitter/description meta keeps one attribute value with no raw quote, angle bracket or ampersand escape left open.
        var metas = Regex.Matches(html, "<meta [^>]*>");
        Assert.NotEmpty(metas);
        foreach (Match meta in metas)
        {
            Assert.DoesNotContain("<script", meta.Value, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("<svg", meta.Value, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("onmouseover='", meta.Value, StringComparison.Ordinal);
        }

        Assert.DoesNotContain("<script>alert", html, StringComparison.Ordinal);
        Assert.DoesNotContain("<svg/onload", html, StringComparison.Ordinal);
        Assert.DoesNotContain("' onmouseover='", html, StringComparison.Ordinal);
        Assert.Matches(@"og:description"" content=""[^""<>]*""", html);
        Assert.Matches(@"og:title"" content=""[^""<>]*""", html);
    }

    [Fact]
    public async Task Preview_CarriesNoNickname_EvenWithHostileAndLongNames()
    {
        var html = await GetHtmlAsync(Path, RoundPageFixture.NineOfTwelve());
        var head = html[..html.IndexOf("</head>", StringComparison.Ordinal)];

        Assert.DoesNotContain("ZZNICK", head, StringComparison.Ordinal);
        Assert.Contains("ZZNICK1", html, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("/r/short")]
    [InlineData("/r/ZZZZZZZZZZZZZZZZZZZZZZ")]
    [InlineData("/r/K7fQ2xK7fQ2xK7fQ2xK7fQ%20")]
    [InlineData("/r/K7fQ2xK7fQ2xK7fQ2xK7f+")]
    [InlineData("/r/K7fQ2xK7fQ2xK7fQ2xK7fQQ")]
    public async Task MalformedAndUnknownCodes_AreByteForByteTheSame404(string path)
    {
        var reference = await Raw("/r/AAAAAAAAAAAAAAAAAAAAAA");
        var other = await Raw(path);

        Assert.Equal(HttpStatusCode.NotFound, other.Status);
        Assert.Equal(reference.Status, other.Status);
        Assert.Equal(reference.Body, other.Body);
        Assert.Equal(reference.CacheControl, other.CacheControl);
        Assert.Equal("no-store", other.CacheControl);
        Assert.Equal(reference.Csp, other.Csp);
    }

    [Fact]
    public async Task Page_IsNoStore_OnEveryAnswer()
    {
        var ok = await Raw(Path);
        var missing = await Raw("/r/nope");

        Assert.Equal("no-store", ok.CacheControl);
        Assert.Equal("no-store", missing.CacheControl);
    }

    private async Task<string> GetHtmlAsync(string path, PublicRoundSummary summary)
    {
        await using var app = RoundPageFixture.Factory(factory, RoundPageFixture.One(summary));
        using var client = app.CreateClient();
        return await client.GetStringAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);
    }

    private async Task<(HttpStatusCode Status, string Body, string? CacheControl, string? Csp)> Raw(string path)
    {
        await using var app = RoundPageFixture.Factory(factory, RoundPageFixture.One(RoundPageFixture.NineOfTwelve()));
        using var client = app.CreateClient();
        using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.Headers.TryGetValues("Content-Security-Policy", out var csp);
        return (response.StatusCode, body, response.Headers.CacheControl?.ToString(), csp?.FirstOrDefault());
    }
}
