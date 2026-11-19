using System.Collections.Immutable;
using System.Globalization;
using System.Text.Json;
using Sacou.Modules.Stats.Domain.Ratings;
using Sacou.Shared.Members;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Stats.Tests.Ratings;

/// <summary>Port of <c>rating-pools.golden.test.ts</c>: our rules around the model, from the same file.</summary>
public sealed class RatingPoolGoldenTests
{
    private const int GoldenCaseCount = 10;
    private const string MemberIdFormat = "D";

    private static readonly string[] GoldenIds =
    [
        "p1-the-admin-seed-moves-less-than-an-unconfirmed-one",
        "p2-no-winner-rates-nobody",
        "p3-the-bench-that-never-came-in-is-not-rated",
        "p4-indoor-and-beach-are-rated-apart",
        "p5-beach-2x2-and-beach-4x4-share-a-pool",
        "p6-play-order-not-arrival-order",
        "p7-a-canceled-round-is-out",
        "p8-a-member-without-a-rated-match-keeps-the-seed",
        "p9-a-member-without-a-seed-starts-at-the-default",
        "p10-two-days-of-six-against-six-with-a-bench",
    ];

    /// <summary>The key order of the contract (rule 25).</summary>
    private static readonly string[] KeyOrder = ["memberId", "pool", "seedTenths", "seedSource", "mu", "sigma", "matchesRated"];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("rating-pools.json");

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

    [Fact]
    public void Golden_WasWrittenWithTheSupportedParameters()
    {
        Assert.Equal(RatingParams.SupportedVersion, RatingGolden.Parameters.RatingParamsVersion);
    }

    [Theory]
    [MemberData(nameof(CaseIds))]
    public void RatingPool_MatchesTheGoldenCase(string id)
    {
        var goldenCase = GoldenFile.SingleCase(Cases, GoldenFile.IdOf, id);

        AssertRatings(goldenCase, RoundsOf(goldenCase), id);
    }

    /// <summary>The order the batches arrived in changes nothing (rule 21).</summary>
    [Theory]
    [MemberData(nameof(CaseIds))]
    public void RatingPool_WithTheRoundsReversed_IsTheSame(string id)
    {
        var goldenCase = GoldenFile.SingleCase(Cases, GoldenFile.IdOf, id);

        AssertRatings(goldenCase, [.. RoundsOf(goldenCase).Reverse()], $"{id} reversed");
    }

    private static void AssertRatings(JsonElement goldenCase, ImmutableArray<RatedRound> rounds, string context)
    {
        var result = RatingPool.Rate(RatingGolden.Parameters, SeedsOf(goldenCase), rounds);
        Assert.True(result.IsSuccess, context);
        var expected = goldenCase.GetProperty("expected").EnumerateArray().ToList();
        Assert.Equal(expected.Count, result.Value.Length);
        for (var index = 0; index < expected.Count; index++)
        {
            AssertRating(expected[index], result.Value[index], $"{context}[{index}]");
        }
    }

    private static void AssertRating(JsonElement expected, MemberRating actual, string context)
    {
        Assert.Equal(KeyOrder, expected.EnumerateObject().Select(member => member.Name));
        Assert.Equal(GoldenFile.Text(expected, "memberId"), actual.MemberId.Value.ToString(MemberIdFormat, CultureInfo.InvariantCulture));
        Assert.Equal(GoldenFile.Text(expected, "pool"), actual.Pool.Code);
        Assert.Equal(expected.GetProperty("seedTenths").GetInt32(), actual.SeedTenths);
        Assert.Equal(GoldenFile.Text(expected, "seedSource"), actual.SeedSource.Code);
        RatingGolden.AssertClose(expected.GetProperty("mu").GetDouble(), actual.Skill.Mu, $"{context}.mu");
        RatingGolden.AssertClose(expected.GetProperty("sigma").GetDouble(), actual.Skill.Sigma, $"{context}.sigma");
        Assert.Equal(expected.GetProperty("matchesRated").GetInt32(), actual.MatchesRated);
    }

    private static ImmutableArray<RatingSeed> SeedsOf(JsonElement goldenCase) =>
        [.. goldenCase.GetProperty("seeds").EnumerateArray().Select(seed => new RatingSeed(
            MemberOf(seed.GetProperty("memberId")),
            seed.GetProperty("levelTenths").GetInt32(),
            SeedSource.FromCode(GoldenFile.Text(seed, "source")) ?? throw new InvalidOperationException("Unknown seed source.")))];

    private static ImmutableArray<RatedRound> RoundsOf(JsonElement goldenCase) =>
        [.. goldenCase.GetProperty("rounds").EnumerateArray().Select(round => new RatedRound(
            Guid.Parse(GoldenFile.Text(round, "roundId")),
            DateTimeOffset.Parse(GoldenFile.Text(round, "startsAt"), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal),
            round.GetProperty("canceled").GetBoolean(),
            RatingPoolKind.OfModality(GoldenFile.Text(round, "modality")) ?? throw new InvalidOperationException("Unknown modality."),
            [.. round.GetProperty("matches").EnumerateArray().Select(MatchOf)]))];

    private static RatedMatch MatchOf(JsonElement match)
    {
        var winner = match.GetProperty("winner");
        var teams = match.GetProperty("teams");
        var onCourt = match.GetProperty("onCourt");
        return new RatedMatch(
            GoldenFile.Text(match, "matchId"),
            winner.ValueKind == JsonValueKind.Null ? null : winner.GetString() == "a" ? MatchSide.A : MatchSide.B,
            MembersOf(teams.GetProperty("a")),
            MembersOf(teams.GetProperty("b")),
            MembersOf(onCourt.GetProperty("a")),
            MembersOf(onCourt.GetProperty("b")));
    }

    private static ImmutableArray<MemberId> MembersOf(JsonElement members) => [.. members.EnumerateArray().Select(MemberOf)];

    private static MemberId MemberOf(JsonElement memberId) => new(Guid.Parse(memberId.GetString()!));
}
