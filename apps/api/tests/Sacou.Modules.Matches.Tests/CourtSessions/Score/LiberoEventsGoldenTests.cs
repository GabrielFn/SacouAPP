using System.Text.Json;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Score;

/// <summary>Port of the golden test of <c>libero-events.json</c>, reading the same file. Key order is part of the contract.</summary>
public sealed class LiberoEventsGoldenTests
{
    private const int GoldenCaseCount = 42;

    private static readonly string[] GoldenIds =
    [
        "l1-step-00-start",
        "l1-step-01-point-a-keeps-the-serve",
        "l1-step-02-point-b-side-out",
        "l1-step-03-point-a-zone-6",
        "l1-step-04-point-b",
        "l1-step-05-point-a-zone-5-the-middle-serves",
        "l1-step-06-point-b-a-loses-the-serve-in-zone-5-and-the-libero-comes-in",
        "l1-step-07-point-a-zone-4",
        "l1-step-08-point-b-2",
        "l1-step-09-point-a-zone-3",
        "l1-step-10-point-b-3",
        "l1-step-11-point-a-zone-2-the-other-middle-serves",
        "l1-step-12-point-b-libero-back-in-position-1",
        "l1-step-13-point-a-back-to-zone-1",
        "l2-revert-of-a-point",
        "l3-change-turns-the-libero-off",
        "l3-revert-of-the-change-brings-the-libero-back",
        "l3-revert-to-the-change-keeps-the-libero-off",
        "l3-change-turns-the-libero-on-for-one-middle",
        "l4-set-won-with-the-libero-out",
        "l4-next-set-keeps-the-zone-and-the-libero-comes-in",
        "l5-finished-match-keeps-the-libero-of-the-end",
        "l6-stale-change-of-another-writer-is-applied",
        "l6-points-after-the-stale-change-rotate-from-it",
        "l7-step-1-libero-covers-a3-in-zone-3",
        "l7-step-2-a6-out-a8-in",
        "l7-step-3-side-out-the-libero-goes-out-and-a8-serves",
        "l7-step-4-lost-serve-the-libero-covers-a8",
        "l8-6x2-zone-4-receiving",
        "r-start-in-the-e2-5-format-without-the-libero",
        "r-change-in-the-e2-5-format-without-the-libero",
        "r-start-libero-in-the-4x2",
        "r-start-libero-on-the-setter",
        "r-change-libero-in-the-4x2",
        "r-change-libero-in-the-livre",
        "r-change-libero-on-the-setter-of-the-5x1",
        "r-change-libero-on-the-second-setter-of-the-6x2",
        "r-change-accepts-the-opposite-in-the-5x1",
        "r-change-libero-of-the-other-team",
        "r-change-libero-outside-the-teams",
        "r-change-leaves-the-libero-out",
        "r-change-libero-on-the-team-without-rotation",
    ];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("libero-events.json");

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

    public static TheoryData<string> OnCourtIds => new(ScoreEventsGolden.IdsWith(Cases, "onCourt"));

    [Fact]
    public void File_ChecksTheCourt_InSomeCases()
    {
        Assert.NotEmpty(ScoreEventsGolden.IdsWith(Cases, "onCourt"));
    }

    [Theory]
    [MemberData(nameof(OnCourtIds))]
    public void OnCourt_MatchesTheGoldenCase(string id)
    {
        ScoreEventsGolden.AssertOnCourt(Cases, id);
    }
}
