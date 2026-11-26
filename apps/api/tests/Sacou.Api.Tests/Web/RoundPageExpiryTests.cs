using System.Net;
using Sacou.Api.Web;
using Sacou.Modules.Sessions.Contracts;
using Xunit;

namespace Sacou.Api.Tests.Web;

/// <summary>
/// E6.7, criteria 2, 3, 5 and 6: 7 days after the start the page shows only the group, the day, the hour, the venue and
/// the state, with the phrase of question 238; no name, place, count, court, waitlist or format, and still no-store.
/// The summaries keep their names on purpose: the page must not draw them even then.
/// </summary>
public sealed class RoundPageExpiryTests(SacouApiFactory factory) : IClassFixture<SacouApiFactory>
{
    private const string Path = "/r/" + RoundPageFixture.Code;
    private const string Place = "Qui, 5/11 · 19h · Arena Beira-Mar";

    [Fact]
    public async Task ExpiredPage_HasOnlyTheGroupTheDayTheVenueAndTheState()
    {
        using var response = await GetAsync(Expired(PublicRoundState.Ended));
        var html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        Assert.Contains("<h1 class=\"title\">Vôlei de quinta</h1>", html, StringComparison.Ordinal);
        Assert.Contains($"<p class=\"when\">{Place}</p>", html, StringComparison.Ordinal);
        Assert.Contains(WebTexts.Ended, html, StringComparison.Ordinal);
        Assert.Contains(WebTexts.ListExpired, html, StringComparison.Ordinal);
        Assert.Contains($"<meta property=\"og:description\" content=\"{Place}\">", html, StringComparison.Ordinal);
        AssertNoList(html);
    }

    [Fact]
    public async Task ExpiredCanceledPage_SaysCanceled_InTheBodyAndThePreview()
    {
        using var response = await GetAsync(Expired(PublicRoundState.Canceled));
        var html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        Assert.Contains(WebTexts.Canceled, html, StringComparison.Ordinal);
        Assert.Contains(
            $"<meta property=\"og:description\" content=\"{Place} · Rodada cancelada\">", html, StringComparison.Ordinal);
        AssertNoList(html);
    }

    [Fact]
    public async Task StartedNeverClosed_Expired_HasNoList()
    {
        using var response = await GetAsync(Expired(PublicRoundState.Started));
        var html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Contains(WebTexts.Started, html, StringComparison.Ordinal);
        AssertNoList(html);
    }

    /// <summary>Criterion 1 on the page: before the cut the names and the count stay, with no-store as well.</summary>
    [Fact]
    public async Task NotExpiredPage_KeepsTheNames()
    {
        using var response = await GetAsync(RoundPageFixture.NineOfTwelve() with { State = PublicRoundState.Ended });
        var html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        Assert.Contains("ZZNICK1", html, StringComparison.Ordinal);
        Assert.Contains("class=\"counts\"", html, StringComparison.Ordinal);
        Assert.DoesNotContain(WebTexts.ListExpired, html, StringComparison.Ordinal);
    }

    [Fact]
    public void ExpiredView_HasNoListNoCountAndNoWindow()
    {
        var view = RoundPageView.From(Expired(PublicRoundState.Ended), DateTimeOffset.UnixEpoch);

        Assert.False(view.ShowsList);
        Assert.Equal((0, (int?)null, string.Empty, false), (view.GoingCount, view.Capacity, view.Format, view.HasRegulars));
        Assert.Empty(view.Lists);
        Assert.Empty(view.Court);
        Assert.Null(view.Hint);
        Assert.Null(view.Notice);
        Assert.Null(view.DropInWindow);
        Assert.Equal(string.Empty, view.DropInPhrase);
    }

    private static void AssertNoList(string html)
    {
        Assert.DoesNotContain("ZZNICK", html, StringComparison.Ordinal);
        Assert.DoesNotContain(WebTexts.NoNickname, html, StringComparison.Ordinal);
        Assert.DoesNotContain(WebTexts.Vacant, html, StringComparison.Ordinal);
        Assert.DoesNotContain(WebTexts.Regulars, html, StringComparison.Ordinal);
        Assert.DoesNotContain(WebTexts.DropIns, html, StringComparison.Ordinal);
        Assert.DoesNotContain("class=\"place\"", html, StringComparison.Ordinal);
        Assert.DoesNotContain("class=\"counts\"", html, StringComparison.Ordinal);
        Assert.DoesNotContain("class=\"court\"", html, StringComparison.Ordinal);
        Assert.DoesNotContain("class=\"format\"", html, StringComparison.Ordinal);
        Assert.DoesNotContain("confirmados", html, StringComparison.Ordinal);
        Assert.DoesNotContain("espera", html, StringComparison.Ordinal);
        Assert.DoesNotContain($"data-code=\"{RoundPageFixture.Code}\"", html, StringComparison.Ordinal);
        Assert.Contains("data-has-regulars=\"false\"", html, StringComparison.Ordinal);
    }

    private static PublicRoundSummary Expired(PublicRoundState state) =>
        RoundPageFixture.NineOfTwelve() with { State = state, ListExpired = true };

    private async Task<HttpResponseMessage> GetAsync(PublicRoundSummary summary)
    {
        await using var app = RoundPageFixture.Factory(factory, RoundPageFixture.One(summary));
        using var client = app.CreateClient();
        var response = await client.GetAsync(new Uri(Path, UriKind.Relative), TestContext.Current.CancellationToken);
        await response.Content.LoadIntoBufferAsync(TestContext.Current.CancellationToken);
        return response;
    }
}
