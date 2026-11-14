using System.Text.Json;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Queue;

/// <summary>Port of the golden test of <c>queue-plans.json</c>, reading the same file. Key order is part of the contract.</summary>
public sealed class QueuePlansGoldenTests
{
    private const int GoldenCaseCount = 32;

    /// <summary>Literal, never read from the file: a case that disappears must fail.</summary>
    private static readonly string[] GoldenIds =
    [
        "q1-review-two-waiting-blue-loses-rafa-and-duda-leave",
        "q2-nobody-waiting-nobody-leaves",
        "q3-manual-end-without-a-winner-nobody-leaves",
        "q4-one-waiting-one-leaves-tie-goes-to-who-arrived-first",
        "q5-pairs-follow-the-team-not-the-criterion-with-the-rotation-off",
        "q6-tie-on-consecutive-goes-to-who-played-most-in-the-round",
        "q7-consecutive-matches-not-the-total-of-the-round",
        "q8-bench-and-libero-count-and-are-replaced",
        "q9-whole-team-waiting-the-loser-leaves-whole-and-the-singles-form-a-team",
        "q10-a-team-waits-behind-another-and-the-winner-on-side-b",
        "q11-six-singles-form-a-team-old-ones-first-then-who-left-in-team-order",
        "q12-loser-of-four-five-waiting-four-leave-five-stay-single",
        "q13-arrival-order-who-arrived-first-leaves",
        "q14-draw-the-first-of-the-shuffled-order-leave",
        "q15-manual-whoever-the-admin-chose",
        "r-manual-one-instead-of-two",
        "r-manual-three-instead-of-two",
        "r-manual-member-of-the-winner",
        "r-manual-someone-waiting",
        "r-manual-repeated",
        "r-draw-missing-a-member",
        "r-draw-with-a-repeat",
        "r-draw-with-an-outsider",
        "r-arrival-order-missing-a-candidate",
        "r-consecutive-without-the-arrival-order",
        "r-unknown-criterion-level",
        "r-criterion-input-null",
        "r-players-per-team-0",
        "r-players-per-team-25",
        "r-players-per-team-fraction",
        "r-with-a-match-open",
        "r-without-a-finished-match",
    ];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("queue-plans.json");

    public static TheoryData<string> CaseIds => new(GoldenIds);

    [Fact]
    public void GoldenList_HasTheExactTotal()
    {
        Assert.Equal(GoldenCaseCount, GoldenIds.Length);
    }

    [Fact]
    public void GoldenList_MatchesTheFile()
    {
        GoldenFile.AssertListMatchesFile(GoldenIds, [.. Cases.Select(GoldenFile.IdOf)]);
    }

    [Theory]
    [MemberData(nameof(CaseIds))]
    public void Plan_MatchesTheGoldenCase(string id)
    {
        NextMatchPlanGolden.AssertCase(Cases, id);
    }
}
