using System.Collections.Immutable;
using Sacou.Modules.Stats.Domain.Ratings;
using Sacou.Shared.Members;
using Xunit;

namespace Sacou.Modules.Stats.Tests.Ratings;

/// <summary>Extra edges of the fold: input order, pool separation, canceled rounds, sigma floor and tau.</summary>
public sealed class RatingPoolExtraTests
{
    private static readonly RatingParams Parameters = RatingGolden.Parameters;
    private static readonly DateTimeOffset Day = new(2026, 11, 1, 22, 0, 0, TimeSpan.Zero);
    private static readonly MemberId Ana = Member(1);
    private static readonly MemberId Bia = Member(2);
    private static readonly MemberId Caio = Member(3);

    private static RatedRound Round(int id, int dayOffset, RatingPoolKind pool, MatchSide winner, bool canceled = false, MemberId? a = null, MemberId? b = null) =>
        new(new Guid(id, 0, 0, new byte[8]), Day.AddDays(dayOffset), canceled, pool,
            [new RatedMatch($"m{id}", winner, [a ?? Ana], [b ?? Bia], [a ?? Ana], [b ?? Bia])]);

    private static ImmutableArray<MemberRating> Rate(params RatedRound[] rounds) =>
        RatingPool.Rate(Parameters, [], [.. rounds]).Value;

    [Fact]
    public void RoundOrderInTheInput_DoesNotChangeTheResult()
    {
        var r1 = Round(1, 0, RatingPoolKind.Indoor, MatchSide.A);
        var r2 = Round(2, 1, RatingPoolKind.Indoor, MatchSide.B);
        var r3 = Round(3, 2, RatingPoolKind.Indoor, MatchSide.A);

        Assert.Equal(Rate(r1, r2, r3), Rate(r3, r1, r2));
        Assert.Equal(Rate(r1, r2, r3), Rate(r2, r3, r1));
    }

    [Fact]
    public void SameInstant_IsOrderedByRoundId_NotByInputOrder()
    {
        var r1 = Round(1, 0, RatingPoolKind.Indoor, MatchSide.A);
        var r2 = Round(2, 0, RatingPoolKind.Indoor, MatchSide.B);

        Assert.Equal(Rate(r1, r2), Rate(r2, r1));
    }

    [Fact]
    public void Pools_AreRatedApart()
    {
        var both = Rate(Round(1, 0, RatingPoolKind.Indoor, MatchSide.A), Round(2, 1, RatingPoolKind.Beach, MatchSide.A));
        var indoorOnly = Rate(Round(1, 0, RatingPoolKind.Indoor, MatchSide.A));

        var anaBeach = both.Single(r => r.MemberId == Ana && r.Pool == RatingPoolKind.Beach);
        var anaIndoor = both.Single(r => r.MemberId == Ana && r.Pool == RatingPoolKind.Indoor);
        Assert.Equal(indoorOnly.Single(r => r.MemberId == Ana).Skill, anaIndoor.Skill);
        Assert.Equal(1, anaBeach.MatchesRated);
        Assert.Equal(1, anaIndoor.MatchesRated);
        Assert.Equal(anaIndoor.Skill, anaBeach.Skill);
    }

    [Fact]
    public void CanceledRound_IsIgnored()
    {
        var ratings = Rate(Round(1, 0, RatingPoolKind.Indoor, MatchSide.A, canceled: true));

        Assert.Empty(ratings);
    }

    [Fact]
    public void Tau_AppliesBeforeTheMatch_NotAfter()
    {
        var one = Rate(Round(1, 0, RatingPoolKind.Indoor, MatchSide.A)).Single(r => r.MemberId == Ana).Skill;
        var noTau = RatingPool.Rate(Parameters with { Tau = 1e-9 }, [], [Round(1, 0, RatingPoolKind.Indoor, MatchSide.A)]).Value.Single(r => r.MemberId == Ana).Skill;

        Assert.NotEqual(noTau.Sigma, one.Sigma);
    }

    [Fact]
    public void WinnerSideDecides_NotTheListOrder()
    {
        var a = Rate(Round(1, 0, RatingPoolKind.Indoor, MatchSide.A, a: Ana, b: Caio));
        var b = Rate(Round(1, 0, RatingPoolKind.Indoor, MatchSide.B, a: Caio, b: Ana));

        Assert.Equal(a.Single(r => r.MemberId == Ana).Skill, b.Single(r => r.MemberId == Ana).Skill);
        Assert.True(a.Single(r => r.MemberId == Ana).Skill.Mu > a.Single(r => r.MemberId == Caio).Skill.Mu);
    }

    private static MemberId Member(int number) => new(new Guid(number, 0, 0, new byte[8]));
}

public sealed class LimitSigmaTests
{
    [Fact]
    public void LimitSigma_NeverEndsAboveTheSigmaBeforeTau()
    {
        var parameters = RatingGolden.Parameters with { LimitSigma = true, Tau = 5 };
        Skill[] tiny = [new Skill(1500, 0.01)];
        var rated = PlackettLuce.Rate(parameters, [.. tiny], [.. tiny]);
        var free = PlackettLuce.Rate(parameters with { LimitSigma = false }, [.. tiny], [.. tiny]);

        Assert.True(free.Winners[0].Sigma > 0.01, "precondition: tau widens sigma past the start");
        Assert.True(rated.Winners[0].Sigma <= 0.01);
        Assert.True(rated.Losers[0].Sigma <= 0.01);
    }
}
