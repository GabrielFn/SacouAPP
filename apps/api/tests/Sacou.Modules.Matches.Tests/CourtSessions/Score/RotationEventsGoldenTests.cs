using System.Text.Json;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Score;

/// <summary>Port of the golden test of <c>rotation-events.json</c>, reading the same file. Key order is part of the contract.</summary>
public sealed class RotationEventsGoldenTests
{
    private const int GoldenCaseCount = 62;

    private static readonly string[] GoldenIds =
    [
        "s1-first-server-wins-does-not-rotate",
        "s1-b-first-server-wins-streak",
        "s1-streak-after-a-side-out-rotates-once",
        "s2-receiver-wins-the-first-rally",
        "s2-b-receiver-wins-the-first-rally",
        "s3-step-01",
        "s3-step-02",
        "s3-step-03",
        "s3-step-04",
        "s3-step-05",
        "s3-step-06",
        "s3-step-07",
        "s3-step-08",
        "s3-step-09",
        "s3-step-10",
        "s3-step-11",
        "s3-step-12",
        "s4-each-team-has-its-own-rotation",
        "s6-side-out-on-the-deciding-point",
        "s6-serving-team-wins-the-set-without-rotating",
        "s7-tie-break-at-8-server-does-not-rotate",
        "s7-tie-break-at-8-only-the-side-out-rotates",
        "s8-first-rally-next-set-server-wins",
        "s8-first-rally-next-set-receiver-wins",
        "s8-first-server-against-alternation-is-applied-as-recorded",
        "s8-zones-against-the-last-set-are-applied-as-recorded",
        "s8-toss-of-the-deciding-set-of-best-of-3",
        "s8-toss-of-the-deciding-set-of-best-of-5",
        "s8-deciding-set-ended-keeps-the-last-zones",
        "s8-null-zone-for-a-team-with-rotation",
        "s8-zone-for-a-team-without-rotation",
        "s9-undo-a-side-out",
        "s9-undo-a-point-after-a-side-out",
        "s9-play-after-undoing-a-side-out",
        "s9-revert-over-set-ended",
        "s10-rotation-off-still-tracks-the-serve",
        "s10-only-one-team-with-rotation",
        "s11-interleaved-writers-are-not-rejected",
        "s11-arrival-order-does-not-change-it",
        "s12-another-rules-version-has-the-same-transition",
        "s13-screen-25-set-1-25-22",
        "s13-screen-25-azul-serves-the-next-set",
        "s13-before-screen-24-12-11",
        "s13-screen-09-18-15",
        "s13-screen-24-back-to-16-14",
        "s13-screen-10-24-21",
        "s14-manual-end-keeps-the-serve-and-the-rotation",
        "s14-a-new-match-starts-from-its-own-setup",
        "s15-match-started-in-the-e2-2-format-is-rejected",
        "s15-set-ended-in-the-e2-2-format-is-rejected",
        "s15-point-with-a-recorded-rotation-is-rejected",
        "s15-lineup-with-a-member-outside-the-team",
        "s15-match-started-in-the-e2-3-format-is-rejected",
        "s15-match-started-without-the-system-is-rejected",
        "s15-match-started-without-formations-version-is-rejected",
        "s15-system-outside-the-catalog-is-rejected",
        "s15-formations-version-0-is-rejected",
        "s16-each-team-keeps-its-own-system",
        "s16-system-survives-the-next-set",
        "s16-system-survives-the-undo",
        "s16-system-survives-the-end-of-the-match",
        "s16-unknown-formations-version-is-applied-as-recorded",
    ];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("rotation-events.json");

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
