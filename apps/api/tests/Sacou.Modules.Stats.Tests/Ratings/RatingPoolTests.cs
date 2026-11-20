using System.Collections.Immutable;
using Sacou.Modules.Stats.Domain.Ratings;
using Sacou.Shared.Members;
using Xunit;

namespace Sacou.Modules.Stats.Tests.Ratings;

/// <summary>The edges of the fold that the golden files show only in passing (rules 18 to 25).</summary>
public sealed class RatingPoolTests
{
    private static readonly RatingParams Parameters = RatingGolden.Parameters;
    private static readonly DateTimeOffset FirstDay = new(2026, 11, 1, 22, 0, 0, TimeSpan.Zero);
    private static readonly MemberId Ana = Member(1);
    private static readonly MemberId Bia = Member(2);
    private static readonly MemberId Caio = Member(3);
    private static readonly MemberId Davi = Member(4);

    [Fact]
    public void SameMember_OnBothSides_IsRefused()
    {
        var result = Rate([], Match(MatchSide.A, [Ana, Bia], [Caio, Ana]));

        Assert.Equal(RatingPool.DuplicateMember, result.Error);
    }

    [Fact]
    public void SameMember_TwiceOnOneSide_IsRefused()
    {
        var result = Rate([], Match(MatchSide.A, [Ana, Ana], [Caio]));

        Assert.Equal(RatingPool.DuplicateMember, result.Error);
    }

    /// <summary>Even in a match that would not be rated: the input is wrong, whatever the winner.</summary>
    [Fact]
    public void SameMember_InAMatchWithoutAWinner_IsRefused()
    {
        var result = Rate([], Match(winner: null, [Ana], [Ana]));

        Assert.Equal(RatingPool.DuplicateMember, result.Error);
    }

    [Theory]
    [InlineData(9)]
    [InlineData(51)]
    public void LevelOffTheScale_IsRefused(int levelTenths)
    {
        var result = Rate([new RatingSeed(Ana, levelTenths, SeedSource.Admin)], Match(MatchSide.A, [Ana], [Bia]));

        Assert.Equal(RatingPool.InvalidLevel, result.Error);
    }

    [Fact]
    public void RepeatedSeed_IsRefused()
    {
        var result = Rate([new RatingSeed(Ana, 30, SeedSource.Admin), new RatingSeed(Ana, 40, SeedSource.Suggested)], Match(MatchSide.A, [Ana], [Bia]));

        Assert.Equal(RatingPool.DuplicateSeed, result.Error);
    }

    /// <summary>A match ended by hand before any rally has nobody on the court and rates nobody (part 1, condition 3).</summary>
    [Fact]
    public void MatchWithNobodyOnTheCourt_KeepsTheSeeds()
    {
        var match = new RatedMatch("m1", MatchSide.A, [Ana, Bia], [Caio, Davi], [], []);

        var ratings = Rate([], match).Value;

        Assert.All(ratings, rating => Assert.Equal(new Skill(Parameters.Mu0, Parameters.SigmaUnconfirmed), rating.Skill));
        Assert.All(ratings, rating => Assert.Equal(0, rating.MatchesRated));
        Assert.Equal([Ana, Bia, Caio, Davi], ratings.Select(rating => rating.MemberId));
    }

    [Fact]
    public void MatchWithoutAWinner_RatesNobody()
    {
        var ratings = Rate([], Match(winner: null, [Ana], [Bia])).Value;

        Assert.All(ratings, rating => Assert.Equal(0, rating.MatchesRated));
    }

    [Fact]
    public void Winner_GainsWhatTheLoserLoses_WithEqualSeeds()
    {
        var ratings = Rate([], Match(MatchSide.B, [Ana], [Bia])).Value;

        Assert.True(ratings[1].Skill.Mu > Parameters.Mu0);
        Assert.Equal(Parameters.Mu0 - ratings[0].Skill.Mu, ratings[1].Skill.Mu - Parameters.Mu0, 9);
    }

    private static Sacou.Shared.Results.Result<ImmutableArray<MemberRating>> Rate(ImmutableArray<RatingSeed> seeds, RatedMatch match) =>
        RatingPool.Rate(Parameters, seeds, [new RatedRound(Guid.Empty, FirstDay, Canceled: false, RatingPoolKind.Indoor, [match])]);

    private static RatedMatch Match(MatchSide? winner, ImmutableArray<MemberId> a, ImmutableArray<MemberId> b) =>
        new("m1", winner, a, b, a, b);

    private static MemberId Member(int number) => new(new Guid(number, 0, 0, new byte[8]));
}
