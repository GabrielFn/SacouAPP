using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Infrastructure;
using Xunit;
using static Sacou.Modules.Sessions.Tests.RoundFixture;
using Reply = Sacou.Modules.Sessions.Domain.Attendances.AttendanceResponse;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>The round link's code, its window and the channel of an answer (E3.12, ADR 0070, D1 to D3).</summary>
public sealed class RoundLinkTests
{
    private const string WellFormed = "K7fQ2xAbCdEfGhIjKlMn-_";

    [Theory]
    [InlineData(WellFormed, true)]
    [InlineData("K7fQ2xAbCdEfGhIjKlMn-", false)]
    [InlineData("K7fQ2xAbCdEfGhIjKlMn-_a", false)]
    [InlineData("K7fQ2xAbCdEfGhIjKlMn+_", false)]
    [InlineData("K7fQ2xAbCdEfGhIjKlMn/_", false)]
    [InlineData("K7fQ2xAbCdEfGhIjKlMn=_", false)]
    [InlineData("K7fQ2xAbCdEfGhIjKlMn _", false)]
    [InlineData("K7fQ2xAbCdEfGhIjKlMné_", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void Code_OnlyTwentyTwoBase64UrlCharacters(string? text, bool wellFormed)
    {
        Assert.Equal(wellFormed, RoundLinkCode.TryParse(text) is not null);
    }

    [Fact]
    public void Code_NeverPrintsItself()
    {
        var code = RoundLinkCode.TryParse(WellFormed)!;

        Assert.DoesNotContain(WellFormed, code.ToString(), StringComparison.Ordinal);
        Assert.DoesNotContain(WellFormed, $"{code}", StringComparison.Ordinal);
    }

    [Fact]
    public void Generator_MakesWellFormedCodes_AllDifferent()
    {
        var generator = new RandomRoundLinkCodeGenerator();
        const int Draws = 1000;

        var codes = Enumerable.Range(0, Draws).Select(_ => generator.NewCode().Value).ToHashSet(StringComparer.Ordinal);

        Assert.Equal(Draws, codes.Count);
        Assert.All(codes, code => Assert.True(RoundLinkCode.IsWellFormed(code)));
    }

    /// <summary>The start itself already closes the link; one tick before it is open; a cancelled round is never open.</summary>
    [Fact]
    public void Link_IsOpenUntilTheStart_ExclusiveOfIt()
    {
        var round = NewRound();
        var start = round.Slot.StartsAt;

        Assert.True(round.IsOpenForLinkAt(start.AddTicks(-1)));
        Assert.False(round.IsOpenForLinkAt(start));
        Assert.False(round.Cancel().Round.IsOpenForLinkAt(start.AddDays(-1)));
    }

    [Fact]
    public void Channel_IsTheAnswersOne_OnANewRow()
    {
        var rules = Rules();

        var round = Respond(NewRound(), rules, 1, Reply.Going, channel: AttendanceChannel.Web).Value.Round;

        Assert.Equal(AttendanceChannel.Web, round.AttendanceOf(Member(1))!.Channel);
    }

    /// <summary>The rule of the sequence: a "vou" that changes nothing keeps the row, its channel included.</summary>
    [Fact]
    public void Channel_DoesNotChange_OnARepeatedAnswer()
    {
        var rules = Rules();
        var round = Answer(NewRound(), rules, 1, Reply.Going);

        var again = Respond(round, rules, 1, Reply.Going, channel: AttendanceChannel.Web).Value;

        Assert.True(again.IsEmpty);
        Assert.Equal(AttendanceChannel.App, again.Round.AttendanceOf(Member(1))!.Channel);
    }

    [Fact]
    public void Channel_FollowsAChangingAnswer_AndAPromotionKeepsIt()
    {
        var rules = Rules(capacity: 1);
        var round = Respond(NewRound(), rules, 1, Reply.Going, channel: AttendanceChannel.Web).Value.Round;
        round = Respond(round, rules, 2, Reply.Going, channel: AttendanceChannel.Web).Value.Round;

        var declined = Respond(round, rules, 1, Reply.NotGoing).Value.Round;

        Assert.Equal(AttendanceChannel.App, declined.AttendanceOf(Member(1))!.Channel);
        Assert.Equal(AttendanceStatus.Promoted, declined.AttendanceOf(Member(2))!.Status);
        Assert.Equal(AttendanceChannel.Web, declined.AttendanceOf(Member(2))!.Channel);
    }

    [Fact]
    public void Channel_OfTheSeededMensalistas_IsTheApp()
    {
        var seeded = RoundReconciliation.SeedRegulars(NewRound(), Rules(), [Member(1)], Now);

        Assert.Equal(AttendanceChannel.App, Assert.Single(seeded.ChangedAttendances).Channel);
    }
}
