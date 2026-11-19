using System.Collections.Immutable;
using System.Text.Json;
using Sacou.Modules.Stats.Domain.Ratings;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Stats.Tests.Ratings;

/// <summary>Port of <c>openskill.golden.test.ts</c>: the C# Plackett-Luce against the numbers of <c>openskill</c> 5.0.1.</summary>
public sealed class OpenSkillGoldenTests
{
    private const int GoldenCaseCount = 9;
    private const int WinnerRank = 1;

    private static readonly string[] GoldenIds =
    [
        "o1-one-against-one",
        "o2-two-against-two",
        "o3-six-against-six",
        "o4-six-against-five",
        "o5-upset-the-weak-team-wins",
        "o6-sigma-held-by-the-kappa-floor",
        "o7-twenty-matches-of-the-same-players",
        "o8-large-and-small-mu",
        "o9-limit-sigma-on",
    ];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("openskill-plackett-luce.json");

    public static TheoryData<string> CaseIds => new(GoldenIds);

    [Fact]
    public void GoldenList_HasTheExactTotal()
    {
        Assert.Equal(GoldenCaseCount, GoldenIds.Length);
    }

    [Fact]
    public void GoldenList_IsTheFile_InOrder()
    {
        Assert.Equal(GoldenIds, Cases.Select(GoldenFile.IdOf));
    }

    /// <summary>Each match starts from the teams the previous one left, as the TypeScript replay does.</summary>
    [Theory]
    [MemberData(nameof(CaseIds))]
    public void PlackettLuce_MatchesTheLibrary(string id)
    {
        var goldenCase = GoldenFile.SingleCase(Cases, GoldenFile.IdOf, id);
        var parameters = WithOptions(goldenCase.GetProperty("options"));
        var teams = goldenCase.GetProperty("teams");
        var (a, b) = (RatingGolden.TeamOf(teams[0]), RatingGolden.TeamOf(teams[1]));
        var ranks = goldenCase.GetProperty("ranks").EnumerateArray().ToList();
        var expected = goldenCase.GetProperty("expected").EnumerateArray().ToList();
        Assert.Equal(ranks.Count, expected.Count);

        for (var game = 0; game < ranks.Count; game++)
        {
            (a, b) = RateGame(parameters, a, b, ranks[game][0].GetInt32() == WinnerRank);
            RatingGolden.AssertTeam(expected[game][0], a, $"{id} game {game} a");
            RatingGolden.AssertTeam(expected[game][1], b, $"{id} game {game} b");
        }
    }

    private static (ImmutableArray<Skill> A, ImmutableArray<Skill> B) RateGame(
        RatingParams parameters,
        ImmutableArray<Skill> a,
        ImmutableArray<Skill> b,
        bool aWins)
    {
        if (aWins)
        {
            var rated = PlackettLuce.Rate(parameters, a, b);
            return (rated.Winners, rated.Losers);
        }

        var reversed = PlackettLuce.Rate(parameters, b, a);
        return (reversed.Losers, reversed.Winners);
    }

    private static RatingParams WithOptions(JsonElement options) =>
        RatingGolden.Parameters with
        {
            Beta = options.GetProperty("beta").GetDouble(),
            Tau = options.GetProperty("tau").GetDouble(),
            Kappa = options.GetProperty("kappa").GetDouble(),
            LimitSigma = options.GetProperty("limitSigma").GetBoolean(),
        };
}
