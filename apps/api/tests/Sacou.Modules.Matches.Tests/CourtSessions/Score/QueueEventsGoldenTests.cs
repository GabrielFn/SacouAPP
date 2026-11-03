using System.Text.Json;
using Sacou.Modules.Matches.Domain.CourtSessions.Queue;
using Sacou.Modules.Matches.Tests.CourtSessions.EventLog;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Score;

/// <summary>Port of the golden test of <c>queue-events.json</c>, reading the same file. Key order is part of the contract.</summary>
public sealed class QueueEventsGoldenTests
{
    private const int GoldenCaseCount = 24;

    private static readonly string[] GoldenIds =
    [
        "e1-match-started-records-the-queue",
        "e2-queue-changed-adds-who-arrived",
        "e2-queue-changed-replaces-and-never-accumulates",
        "e2-queue-changed-empties-the-queue",
        "e3-queue-changed-with-someone-on-the-court-is-rejected",
        "e3-queue-changed-with-a-court-member-in-a-queue-team-is-rejected",
        "e4-queue-changed-with-someone-repeated-is-rejected",
        "e5-queue-changed-with-96-is-applied",
        "e5-queue-changed-with-97-is-rejected",
        "e6-queue-team-with-0-is-rejected",
        "e6-queue-team-with-25-is-rejected",
        "e7-queue-changed-without-an-open-match-is-rejected",
        "e7-queue-changed-with-another-match-id-is-rejected",
        "e7-queue-changed-as-first-event-is-rejected",
        "e8-interleaved-writers-the-last-in-canonical-order-wins",
        "e9-revert-before-the-queue-changed-brings-back-the-queue-of-the-match-started",
        "e10-second-match-started-records-its-queue",
        "e10-revert-before-the-second-match-started-brings-back-the-queue-and-the-count",
        "e11-match-started-without-the-queue-is-rejected",
        "e11-match-started-with-a-null-queue-is-rejected",
        "e11-match-started-queue-overlapping-the-teams-is-rejected",
        "e12-match-ended-keeps-the-queue",
        "e13-consecutive-matches-across-three-matches",
        "e14-200-finished-matches-count-in-a-row",
    ];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("queue-events.json");

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

    public static TheoryData<string> ConsecutiveIds => new(ScoreEventsGolden.IdsWith(Cases, "consecutiveMatches"));

    [Fact]
    public void File_CountsConsecutiveMatches_InSomeCases()
    {
        Assert.NotEmpty(ScoreEventsGolden.IdsWith(Cases, "consecutiveMatches"));
    }

    [Theory]
    [MemberData(nameof(ConsecutiveIds))]
    public void ConsecutiveMatches_MatchTheGoldenCase(string id)
    {
        var goldenCase = GoldenFile.SingleCase(Cases, GoldenFile.IdOf, id);
        var state = ScoreEventsGolden.Run(goldenCase).State;
        var expected = goldenCase.GetProperty("consecutiveMatches");

        OrderedJsonAssert.Equal(expected, writer =>
        {
            writer.WriteStartObject();
            foreach (var member in expected.EnumerateObject())
            {
                writer.WriteNumber(member.Name, MatchHistory.GetConsecutiveMatches(state, member.Name));
            }

            writer.WriteEndObject();
        }, id);
    }
}
