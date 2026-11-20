using Sacou.Modules.Sessions.Domain;
using Sacou.Modules.Sessions.Domain.Rounds;
using Xunit;
using static Sacou.Modules.Sessions.Tests.RoundFixture;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>Edges of the end of a round (ADR 0072, D1), with literal hours so a changed constant is caught.</summary>
public sealed class RoundCloseBoundaryTests
{
    [Fact]
    public void TheAutomaticEnd_IsSixLiteralHours() => Assert.Equal(6, SessionLimits.RoundAutoEndHours);

    [Fact]
    public void ACloseATickBeforeTheStart_IsRefused()
    {
        var round = NewRound();

        var closed = round.Close(round.Slot.StartsAt.AddTicks(-1));

        Assert.True(closed.IsFailure);
        Assert.Equal(RoundErrors.RoundNotStarted, closed.Error);
    }

    [Fact]
    public void ACloseAtTheVeryStart_IsAccepted()
    {
        var round = NewRound();

        Assert.Equal(round.Slot.StartsAt, round.Close(round.Slot.StartsAt).Value.Round.EndsAt);
    }

    [Fact]
    public void TheAutomaticEnd_IsExactlyStartPlusSixHours()
    {
        var startsAt = new DateTimeOffset(2026, 11, 20, 23, 30, 0, TimeSpan.Zero);

        Assert.Equal(new DateTimeOffset(2026, 11, 21, 5, 30, 0, TimeSpan.Zero), RoundEnd.Of(startsAt, closedAt: null));
        Assert.Equal(startsAt.AddHours(6), RoundEnd.Of(startsAt, startsAt.AddHours(6)));
        Assert.Equal(startsAt.AddHours(6).AddTicks(-1), RoundEnd.Of(startsAt, startsAt.AddHours(6).AddTicks(-1)));
        Assert.Equal(startsAt.AddHours(6), RoundEnd.Of(startsAt, startsAt.AddHours(6).AddTicks(1)));
    }
}
