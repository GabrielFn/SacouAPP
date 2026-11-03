using System.Text.Json;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Score;

/// <summary>Port of the golden test of <c>attributions-events.json</c>, reading the same file. The state and the active events; <c>attributions</c> comes with the resolver, in the next part.</summary>
public sealed class AttributionsEventsGoldenTests
{
    private const int GoldenCaseCount = 16;

    private static readonly string[] GoldenIds =
    [
        "a1-attributed-at-once",
        "a2-attributed-later",
        "a3-the-last-attribution-wins",
        "a4-opponent-error-has-no-author",
        "a5-undone-attribution-is-not-counted",
        "a6-attribution-of-a-reverted-point-is-ignored",
        "a7-attribution-of-an-event-that-is-not-a-point-is-ignored",
        "a8-attribution-of-another-match-is-rejected",
        "a9-attribution-to-a-point-of-an-earlier-match-is-ignored",
        "a10-author-of-the-other-team-is-ignored",
        "a11-an-ignored-attribution-does-not-erase-the-valid-one",
        "a12-author-outside-the-match-is-rejected",
        "a13-attribution-before-the-point-in-the-canonical-order",
        "a14-attribution-in-a-decided-set",
        "a15-attribution-in-a-closed-set",
        "a16-attribution-after-the-end-of-the-match-is-rejected",
    ];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("attributions-events.json");

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
        ScoreEventsGolden.AssertCase(Cases, id, "attributions");
    }
}
