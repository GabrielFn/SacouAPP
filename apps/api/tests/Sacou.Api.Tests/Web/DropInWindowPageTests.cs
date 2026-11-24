using Sacou.Api.Web;
using Sacou.Modules.Sessions.Contracts;
using Xunit;

namespace Sacou.Api.Tests.Web;

/// <summary>R101 Part 2: the avulsos' window explained on the public page, in the round's own time zone (ADR 0079).</summary>
public sealed class DropInWindowPageTests(SacouApiFactory factory) : IClassFixture<SacouApiFactory>
{
    private const string Path = "/r/" + RoundPageFixture.Code;

    // The fixture round starts on Thursday 5/11 at 19h in São Paulo (22:00 UTC); its window opens 24 h before: Wednesday 4/11 at 19h.
    private static readonly DateTimeOffset Opens = new(2026, 11, 4, 22, 0, 0, TimeSpan.Zero);

    private static PublicRoundSummary WithWindow(PublicRoundState state = PublicRoundState.Open) =>
        RoundPageFixture.NineOfTwelve() with { State = state, DropInOpensAt = Opens };

    [Fact]
    public void BeforeTheWindow_SaysWhenItOpens_Today()
    {
        var view = RoundPageView.From(WithWindow(), Opens.AddHours(-3));

        Assert.Equal("A lista dos avulsos abre hoje, às 19h.", view.DropInWindow);
        Assert.Equal("hoje, às 19h", view.DropInPhrase);
    }

    [Fact]
    public void BeforeTheWindow_Tomorrow_AndADayWithTheDate()
    {
        Assert.Equal("amanhã, às 19h", RoundPageView.From(WithWindow(), Opens.AddDays(-1)).DropInPhrase);
        Assert.Equal("na quarta, 4/11, às 19h", RoundPageView.From(WithWindow(), Opens.AddDays(-5)).DropInPhrase);
    }

    [Fact]
    public void WeekendDays_TakeNo_AndTheMinutesShow()
    {
        var saturday = new DateTimeOffset(2026, 11, 28, 23, 30, 0, TimeSpan.Zero);

        var view = RoundPageView.From(WithWindow() with { DropInOpensAt = saturday }, Opens.AddDays(-9));

        Assert.Equal("no sábado, 28/11, às 20h30", view.DropInPhrase);
    }

    [Fact]
    public void TodayAndTomorrow_FollowTheRoundsZone_NotUtc()
    {
        // 02:30 UTC on 5/11 is still 4/11 at 23h30 in São Paulo, and so is the clock at 00:00 UTC on 5/11 (21h on 4/11).
        var lateOpening = Opens.AddHours(4).AddMinutes(30);
        var now = new DateTimeOffset(2026, 11, 5, 0, 0, 0, TimeSpan.Zero);

        var view = RoundPageView.From(WithWindow() with { DropInOpensAt = lateOpening }, now);

        Assert.Equal("hoje, às 23h30", view.DropInPhrase);
    }

    [Theory]
    [InlineData(PublicRoundState.Open)]
    [InlineData(PublicRoundState.Full)]
    public void OpenAndFull_ShowTheLine(PublicRoundState state) =>
        Assert.NotNull(RoundPageView.From(WithWindow(state), Opens.AddHours(-1)).DropInWindow);

    [Theory]
    [InlineData(PublicRoundState.Canceled)]
    [InlineData(PublicRoundState.Started)]
    [InlineData(PublicRoundState.Ended)]
    public void ClosedRounds_ShowNoLine(PublicRoundState state)
    {
        var view = RoundPageView.From(WithWindow(state), Opens.AddHours(-1));

        Assert.Equal((null, string.Empty), (view.DropInWindow, view.DropInPhrase));
    }

    [Fact]
    public void WindowOpenOrOff_ShowsNoLine()
    {
        Assert.Null(RoundPageView.From(WithWindow(), Opens).DropInWindow);
        Assert.Null(RoundPageView.From(WithWindow(), Opens.AddHours(1)).DropInWindow);
        Assert.Null(RoundPageView.From(RoundPageFixture.NineOfTwelve(), Opens.AddDays(-3)).DropInWindow);
    }

    [Fact]
    public void HasRegulars_FollowsTheList()
    {
        Assert.True(RoundPageView.From(WithWindow(), Opens).HasRegulars);
        Assert.False(RoundPageView.From(WithWindow() with { Going = [new PublicListEntry("Ana", false)] }, Opens).HasRegulars);
    }

    [Fact]
    public async Task Page_HasTheLine_AndTheDataTheScriptReads()
    {
        var future = DateTimeOffset.UtcNow.AddDays(3);

        var html = await PageAsync(WithWindow() with { DropInOpensAt = future });

        Assert.Contains("A lista dos avulsos abre ", html, StringComparison.Ordinal);
        Assert.Contains("data-has-regulars=\"true\"", html, StringComparison.Ordinal);
        Assert.Contains("data-drop-in-phrase=\"", html, StringComparison.Ordinal);
        Assert.DoesNotContain("data-drop-in-phrase=\"\"", html, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Page_WithoutTheWindow_HasNoLine_AndAnEmptyPhrase()
    {
        var html = await PageAsync(RoundPageFixture.NineOfTwelve());

        Assert.DoesNotContain("A lista dos avulsos abre", html, StringComparison.Ordinal);
        Assert.Contains("data-drop-in-phrase=\"\"", html, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Page_HasTheLeaveConfirmation_HiddenUntilTheScriptAsksForIt()
    {
        var html = await PageAsync(RoundPageFixture.NineOfTwelve());

        var from = html.IndexOf("id=\"leave-confirm\"", StringComparison.Ordinal);
        Assert.True(from > 0);
        Assert.Contains("hidden>", html[from..html.IndexOf("</div>", from, StringComparison.Ordinal)], StringComparison.Ordinal);
        Assert.Contains("Sair da lista?", html, StringComparison.Ordinal);
        Assert.Contains("CONTINUAR NA LISTA", html, StringComparison.Ordinal);
    }

    private async Task<string> PageAsync(PublicRoundSummary summary)
    {
        await using var app = RoundPageFixture.Factory(factory, RoundPageFixture.One(summary));
        using var client = app.CreateClient();
        return await client.GetStringAsync(new Uri(Path, UriKind.Relative), TestContext.Current.CancellationToken);
    }
}
