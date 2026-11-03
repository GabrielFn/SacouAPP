using System.Text.Json;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Score;

/// <summary>Port of the golden test of <c>bench-events.json</c>, reading the same file. Key order is part of the contract.</summary>
public sealed class BenchEventsGoldenTests
{
    private const int GoldenCaseCount = 49;

    private static readonly string[] GoldenIds =
    [
        "c1-step-1-point-a",
        "c1-step-2-a-out-g-in-the-new-server",
        "c1-step-3-point-b-side-out",
        "c1-step-4-point-a-side-out",
        "c1-step-5-c-out-a-back-in",
        "c2-step-1-d-out-h-in-skips-the-first-of-the-queue",
        "c2-step-2-a-out-g-in-after-points",
        "c2-step-3-h-out-d-back-after-side-outs",
        "c3-a-change-does-not-move-b",
        "c3-b-change-does-not-move-a",
        "c4-a-whole-set-only-moves-the-zones",
        "c5-six-players-have-an-empty-bench",
        "c6-screen-22-swap-on-the-court-and-new-zone",
        "c6-screen-22-with-six-players-keeps-the-empty-bench",
        "c6-the-system-does-not-change",
        "c7-rotation-off-rejects-the-change",
        "c7-the-other-team-goes-on",
        "c8-next-set-keeps-bench-and-lineup",
        "c8-last-set-keeps-them-without-a-next-set",
        "c8-finished-match-keeps-the-bench-of-the-end",
        "c9-revert-restores-lineup-and-bench",
        "c9-revert-restores-the-zone",
        "c9-revert-to-the-change-keeps-it",
        "c10-stale-change-after-a-change-and-points-is-applied",
        "c10-points-after-a-stale-change-rotate-from-it",
        "c12-start-without-the-bench-the-e2-4-format",
        "c12-start-bench-null",
        "c12-start-bench-incomplete",
        "c12-start-bench-empty-with-eight-members",
        "c12-start-bench-member-outside-the-team",
        "c12-start-bench-overlaps-the-lineup",
        "c12-start-bench-repeated",
        "c12-start-24-members-have-a-bench-of-18",
        "c12-change-unknown-key",
        "c12-change-without-the-bench",
        "c12-change-bench-null",
        "c12-change-bench-repeated",
        "c12-change-bench-overlaps-the-lineup",
        "c13-change-as-the-first-event",
        "c13-change-with-another-match-id",
        "c13-change-after-the-match-ended",
        "c13-lineup-with-a-member-of-the-other-team",
        "c13-bench-with-an-outsider-of-the-right-size",
        "c13-bench-short-of-the-team",
        "c13-bench-past-the-team",
        "c13-change-with-the-set-closed-and-the-match-open",
        "c13-identical-change-is-applied-without-effect",
        "d4-partition-of-the-teams-is-applied-on-a-drifted-state",
        "d4-partition-of-the-state-only-is-rejected",
    ];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("bench-events.json");

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
