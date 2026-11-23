using Sacou.Modules.Sessions.Contracts;
using Sacou.Modules.Sessions.Domain;
using Sacou.Modules.Sessions.Domain.Rounds;
using Xunit;
using static Sacou.Modules.Sessions.Tests.RoundFixture;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>The end of a round (ADR 0072, D1): J5 and J6 of E3.18, and the close as the domain decides it.</summary>
public sealed class RoundCloseTests
{
    /// <summary>J5: started at 20:30 and closed at 22:00, it ended at 22:00 (the vote then closes at 22:00 the next day).</summary>
    [Fact]
    public void J5_AClose_EndsTheRoundAtTheTap()
    {
        var round = NewRound();
        var tap = round.Slot.StartsAt.AddMinutes(90);

        var closed = round.Close(tap, hasFinishedMatch: false).Value;

        Assert.Equal(tap, closed.Round.ClosedAt);
        Assert.Equal(tap, closed.Round.EndsAt);
        Assert.True(closed.RoundRowChanged);
        Assert.Equal(new RoundEnded(round.Id, round.GroupId), Assert.Single(closed.Events));
    }

    /// <summary>J5: nobody closed it, so it ends on its own six hours after the start (20:30 to 02:30).</summary>
    [Fact]
    public void J5_WithoutAClose_TheRoundEndsSixHoursAfterTheStart()
    {
        var round = NewRound();

        Assert.Null(round.ClosedAt);
        Assert.Equal(round.Slot.StartsAt.AddHours(SessionLimits.RoundAutoEndHours), round.EndsAt);
    }

    /// <summary>J6: a tap after the automatic end is stored, but the earlier end wins.</summary>
    [Fact]
    public void J6_AClosePastTheAutomaticEnd_DoesNotPutTheEndOff()
    {
        var round = NewRound();
        var late = round.Slot.StartsAt.AddHours(SessionLimits.RoundAutoEndHours + 2);

        var closed = round.Close(late, hasFinishedMatch: false).Value.Round;

        Assert.Equal(late, closed.ClosedAt);
        Assert.Equal(round.Slot.StartsAt.AddHours(SessionLimits.RoundAutoEndHours), closed.EndsAt);
    }

    /// <summary>J6: closing twice keeps the first instant and changes nothing.</summary>
    [Fact]
    public void J6_ClosingAgain_KeepsTheFirstInstant()
    {
        var round = NewRound();
        var first = round.Close(round.Slot.StartsAt.AddHours(1), hasFinishedMatch: false).Value.Round;

        var again = first.Close(round.Slot.StartsAt.AddHours(2), hasFinishedMatch: false).Value;

        Assert.True(again.IsEmpty);
        Assert.Equal(first.ClosedAt, again.Round.ClosedAt);
    }

    /// <summary>I6: the instant is kept in whole microseconds, as the database does, so the answer equals a later read.</summary>
    [Fact]
    public void TheCloseInstant_HasTheDatabasePrecision()
    {
        var round = NewRound();
        var tap = round.Slot.StartsAt.AddHours(1).AddTicks(7);

        Assert.Equal(round.Slot.StartsAt.AddHours(1), round.Close(tap, hasFinishedMatch: false).Value.Round.ClosedAt);
    }

    [Fact]
    public void ACancelledRound_DoesNotClose()
    {
        var canceled = NewRound().Cancel().Round;

        Assert.Equal(RoundErrors.RoundCanceled, canceled.Close(Now, hasFinishedMatch: false).Error);
    }

    /// <summary>J6: the end is counted in instants, so the night the offset changes still has six hours.</summary>
    [Fact]
    public void TheAutomaticEnd_IsCountedInInstants()
    {
        var startsAt = new DateTimeOffset(2026, 10, 31, 22, 0, 0, TimeSpan.FromHours(-3));

        Assert.Equal(TimeSpan.FromHours(SessionLimits.RoundAutoEndHours), RoundEnd.Of(startsAt, closedAt: null) - startsAt);
    }

    /// <summary>The contract the Stats reads carries the same end as the domain.</summary>
    [Fact]
    public void TheRoundFacts_HaveTheSameEnd()
    {
        var round = NewRound();
        var tap = round.Slot.StartsAt.AddHours(1);
        var rules = new Groups.Contracts.SummaryRules(Groups.Contracts.GameModality.Indoor6x6, true, true, false);
        var facts = new RoundFacts(round.Id.Value, RoundState.Scheduled, round.Slot.StartsAt, round.Slot.Date, rules) { ClosedAt = tap };

        Assert.Equal(round.Close(tap, hasFinishedMatch: false).Value.Round.EndsAt, facts.EndsAt);
    }
}
