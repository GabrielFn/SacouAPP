using System.Text.Json;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Score;

/// <summary>Port of the golden test of <c>score-events.json</c>, reading the same file. Key order is part of the contract.</summary>
public sealed class ScoreEventsGoldenTests
{
    private const int GoldenCaseCount = 58;

    private static readonly string[] GoldenIds =
    [
        "g1-one-set-25-23-ends-the-match",
        "g2-best-of-3-ends-in-two-sets",
        "g2-point-after-the-end-is-rejected",
        "g3-second-set-keeps-the-regular-target",
        "g3-third-set-opens-with-the-tie-break-target",
        "g3-best-of-3-with-tie-break-a-wins",
        "g4-fourth-set-keeps-the-regular-target",
        "g4-fifth-set-opens-with-the-tie-break-target",
        "g4-best-of-5-a-wins-3-2",
        "g5-advantage-26-24-recorded-as-played",
        "g5-no-advantage-25-24-recorded-as-played",
        "g6-undo-the-first-point-goes-back-to-match-started",
        "g7-point-as-first-event",
        "g7-set-ended-as-first-event",
        "g7-match-ended-as-first-event",
        "g7-reverted-to-as-first-event",
        "g8-only-match-started",
        "g8-empty-log",
        "g9-frozen-copy-with-another-rules-version",
        "g10-revert-over-set-ended-reopens-the-set",
        "g10-play-goes-on-after-reopening-a-set",
        "g10-revert-over-match-ended-reopens-the-match",
        "g10-revert-over-both-reopens-the-last-set",
        "g11-undo-the-last-point-of-a-decided-set",
        "g12-second-match-starts-at-zero",
        "g12-finished-matches-keep-their-order",
        "g12-revert-to-the-end-of-the-first-match",
        "g13-match-started-with-a-match-open",
        "g13-match-id-repeated-while-open",
        "g13-match-id-repeated-after-it-finished",
        "g14-set-ended-at-10-8-is-applied-as-recorded",
        "g14-winner-behind-is-applied-as-recorded",
        "g14-next-target-against-the-rule-is-applied-as-recorded",
        "g14-match-end-against-the-sets-is-applied-as-recorded",
        "g15-point-with-another-match-id",
        "g15-point-with-another-set-number",
        "g15-late-point-of-a-closed-set",
        "g15-set-ended-with-another-match-id",
        "g15-set-ended-with-another-set-number",
        "g15-point-without-an-open-set",
        "g15-set-ended-without-an-open-set",
        "g15-sets-won-with-a-set-open",
        "g15-match-ended-with-another-match-id",
        "g15-next-set-past-the-format-in-one-set",
        "g15-next-set-past-the-format-in-best-of-3",
        "g16-manual-end-with-a-winner-keeps-the-partial",
        "g16-manual-end-without-a-winner-keeps-the-partial",
        "g16-manual-end-right-after-match-started",
        "g17-deciding-set-ended-without-match-ended",
        "g17-point-is-rejected-while-pending",
        "g17-match-ended-completes-the-pending-end",
        "g18-invalid-team-in-the-middle-of-the-log",
        "g18-personal-data-in-the-payload",
        "g18-proto-key-in-the-payload",
        "g18-set-ended-resent-is-ignored",
        "g18-unknown-type-still-fails-closed",
        "g19-200-finished-matches-are-accepted",
        "g19-match-started-after-200-finished-is-rejected",
    ];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("score-events.json");

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
    public void Replay_MatchesTheGoldenCase(string id)
    {
        ScoreEventsGolden.AssertCase(Cases, id);
    }
}
