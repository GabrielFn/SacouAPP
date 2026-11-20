using System.Net;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Sacou.Api.Web;
using Sacou.Modules.Sessions.Contracts;
using Xunit;

namespace Sacou.Api.Tests.Web;

/// <summary>The parts of the round page without the HTML: the screen's lists, the CSP, the manifest and the files' headers.</summary>
public sealed class WebPartsTests(SacouApiFactory factory) : IClassFixture<SacouApiFactory>
{
    [Fact]
    public void WithoutMensalistas_OneListOfConfirmed_WithTheOpenSpots()
    {
        var summary = RoundPageFixture.NineOfTwelve() with
        {
            GoingCount = 2,
            Going = [new PublicListEntry("Ana", false), new PublicListEntry(null, false)],
        };

        var view = RoundPageView.From(summary);

        var list = Assert.Single(view.Lists);
        Assert.Equal(("Confirmados", "2 de 12"), (list.Title, list.Count));
        Assert.Equal(["Ana", "Sem apelido"], list.Lines.Take(2).Select(line => line.Name));
        Assert.Equal(10, list.Lines.Count(line => line.IsVacant));
        Assert.Equal(12, list.Lines[^1].Place);
    }

    [Fact]
    public void WithoutALimit_NoOpenSpots_AndThePreviewSaysOnlyTheCount()
    {
        var view = RoundPageView.From(RoundPageFixture.NineOfTwelve() with { Capacity = null });

        Assert.DoesNotContain(view.Lists.SelectMany(list => list.Lines), line => line.IsVacant);
        Assert.Equal("Qui, 5/11 · 19h · Arena Beira-Mar · 9 confirmados", view.PreviewDescription);
        Assert.Null(view.Hint);
        Assert.Equal(9, view.Court.Count);
    }

    [Fact]
    public void FullWithAWaitlist_SaysHowManyWait()
    {
        var view = RoundPageView.From(RoundPageFixture.NineOfTwelve() with { State = PublicRoundState.Full, GoingCount = 12, WaitlistCount = 2 });

        Assert.Equal(("Lotou. Se você for, entra na espera.", "2 na espera"), (view.Hint, view.Notice));
    }

    [Theory]
    [InlineData(0, "Dom")]
    [InlineData(6, "Sáb")]
    public void Day_IsTheShortPortugueseWeekday(int offset, string weekday)
    {
        var sunday = new DateOnly(2026, 11, 1);

        Assert.StartsWith(weekday + ",", WebTexts.Day(sunday.AddDays(offset)), StringComparison.Ordinal);
    }

    [Fact]
    public void Csp_JoinsTheAuthDomain_AndRefusesAWildcard()
    {
        var csp = ContentSecurityPolicy.Build(
            new WebSecurityOptions { ConnectSources = ["https://identitytoolkit.googleapis.com"] },
            new FirebaseWebOptions { AuthDomain = "sacou-79493.firebaseapp.com" });

        Assert.Contains("frame-src https://sacou-79493.firebaseapp.com;", csp, StringComparison.Ordinal);
        Assert.Contains("script-src 'self';", csp, StringComparison.Ordinal);
        Assert.Contains("connect-src 'self' https://identitytoolkit.googleapis.com;", csp, StringComparison.Ordinal);
        var validator = new WebSecurityOptionsValidator();
        Assert.True(validator.Validate(null, new WebSecurityOptions { ScriptSources = ["https://*.google.com"] }).Failed);
        Assert.True(validator.Validate(null, new WebSecurityOptions { ConnectSources = ["'unsafe-inline'"] }).Failed);
        Assert.True(validator.Validate(null, new WebSecurityOptions { FrameSources = ["http://accounts.google.com"] }).Failed);
        Assert.True(new WebSetup.FirebaseWebOptionsValidator().Validate(null, new FirebaseWebOptions { AuthDomain = "x.com; script-src *" }).Failed);
    }

    [Fact]
    public void FrameSources_EmptyWithoutTheConfig_IsNone()
    {
        var csp = ContentSecurityPolicy.Build(new WebSecurityOptions(), new FirebaseWebOptions());

        Assert.Contains("frame-src 'none'", csp, StringComparison.Ordinal);
    }

    [Fact]
    public void Manifest_GivesTheEntryWithItsStyles()
    {
        using var manifest = JsonDocument.Parse(
            """{"src/main.ts":{"file":"assets/round-AB.js","isEntry":true,"css":["assets/round-CD.css"]},"src/fonts/x.woff2":{"file":"assets/x.woff2"}}""");

        var entry = ManifestWebAssets.Parse(manifest.RootElement, ManifestWebAssets.EntryKey);

        Assert.Equal("/web/assets/round-AB.js", entry?.Script);
        Assert.Equal(["/web/assets/round-CD.css"], entry?.Styles);
        using var empty = JsonDocument.Parse("{}");
        Assert.Null(ManifestWebAssets.Parse(empty.RootElement, ManifestWebAssets.EntryKey));
    }

    [Fact]
    public void Manifest_GivesEachPage_TheStylesOfTheChunksItImports()
    {
        using var manifest = JsonDocument.Parse(
            """{"src/main.ts":{"file":"assets/round-AB.js","isEntry":true,"imports":["_shared.js"],"css":["assets/round-EF.css"]},"src/invite-main.ts":{"file":"assets/invite-GH.js","isEntry":true,"imports":["_shared.js"]},"_shared.js":{"file":"assets/shared-IJ.js","imports":["_shared.js"],"css":["assets/shared-CD.css"]}}""");

        var round = ManifestWebAssets.Parse(manifest.RootElement, ManifestWebAssets.EntryKey);
        var invite = ManifestWebAssets.Parse(manifest.RootElement, ManifestWebAssets.InviteEntryKey);

        Assert.Equal(["/web/assets/shared-CD.css", "/web/assets/round-EF.css"], round?.Styles);
        Assert.Equal("/web/assets/invite-GH.js", invite?.Script);
        Assert.Equal(["/web/assets/shared-CD.css"], invite?.Styles);
    }

    [Fact]
    public void RealComposition_ValidatesTheWebSecuritySection()
    {
        var options = factory.Services.GetRequiredService<IOptions<WebSecurityOptions>>().Value;

        Assert.Contains("https://apis.google.com", options.ScriptSources);
    }

    /// <summary>Case 27, the files: the preview image cached for a day, no sniffing; the manifest never served.</summary>
    [Fact]
    public async Task Files_HaveTheirHeaders_AndTheManifestIsNotServed()
    {
        using var client = factory.CreateClient();

        using var image = await client.GetAsync(new Uri("/brand/og-image.png", UriKind.Relative), TestContext.Current.CancellationToken);
        using var manifest = await client.GetAsync(new Uri("/web/manifest.json", UriKind.Relative), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, image.StatusCode);
        Assert.Equal("image/png", image.Content.Headers.ContentType?.MediaType);
        Assert.Equal("public, max-age=86400", image.Headers.CacheControl?.ToString());
        Assert.Equal("nosniff", string.Join(",", image.Headers.GetValues("X-Content-Type-Options")));
        Assert.True(image.Content.Headers.ContentLength < 300 * 1024);
        Assert.Equal(HttpStatusCode.NotFound, manifest.StatusCode);
    }
}
