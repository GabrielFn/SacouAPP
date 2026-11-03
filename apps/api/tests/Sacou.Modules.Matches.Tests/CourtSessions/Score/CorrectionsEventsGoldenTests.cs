using System.Text.Json;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Score;

/// <summary>Port of the golden test of <c>corrections-events.json</c>, reading the same file. Key order is part of the contract.</summary>
public sealed class CorrectionsEventsGoldenTests
{
    private const int GoldenCaseCount = 29;

    private static readonly string[] GoldenIds =
    [
        "c1-before-the-revert",
        "c1-revert-to-the-third-point-brings-everything-back",
        "c4-side-out-b-serves-in-zone-4",
        "c4-undo-gives-the-serve-back-and-b-returns-to-zone-5",
        "c5-undo-the-set-end-back-to-25-20-decided",
        "c5-the-same-set-end-again-opens-set-2",
        "c7-girar-1-to-6",
        "c7-girar-6-to-5",
        "c7-girar-2-to-1",
        "c7-desgirar-1-to-2",
        "c7-desgirar-6-to-1",
        "c7-desgirar-2-to-3",
        "c8-girar-to-6-then-lose-and-win-the-serve-goes-to-5",
        "c9-switch-at-0-0-of-set-2-changes-both",
        "c9-set-3-starts-with-the-other-of-the-corrected-first-server",
        "c10-switch-at-10-8-changes-only-the-serve",
        "c10-next-point-of-the-new-server-does-not-rotate",
        "c10-undo-of-the-switch-gives-the-serve-back",
        "c11-rotation-off-in-both-teams-is-applied",
        "c11-closed-set-is-rejected",
        "c12-another-set-number-is-rejected",
        "c12-another-match-is-rejected",
        "c12-the-current-values-change-nothing",
        "c12-first-server-is-recorded-as-it-comes",
        "c12-at-0-0-the-recorded-first-server-stays",
        "c12-of-two-writers-the-last-in-the-canonical-order-wins",
        "c13-serving-the-middle-in-position-1-serves",
        "c13-after-the-switch-the-libero-covers-position-1",
        "c14-stale-girar-of-another-writer-keeps-the-recorded-zone",
    ];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("corrections-events.json");

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
