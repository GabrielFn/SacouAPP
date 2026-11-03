using System.Text.Json;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Tests.CourtSessions.EventLog;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Score;

/// <summary>Port of the "score rules golden" of <c>score.golden.test.ts</c>, reading the same file.</summary>
public sealed class ScoreRulesGoldenTests
{
    private const int GoldenCaseCount = 48;

    private static readonly string[] GoldenIds =
    [
        "r1-0-0",
        "r1-24-22-set-point-a",
        "r1-25-22-a-wins",
        "r1-25-23-a-wins",
        "r1-22-25-b-wins",
        "r1-22-24-set-point-b",
        "r2-25-24-advantage-not-decided",
        "r2-24-24-no-set-point",
        "r2-26-24-a-wins",
        "r2-29-28-set-point-a",
        "r2-28-30-b-wins",
        "r3-no-advantage-25-24-a-wins",
        "r3-no-advantage-24-25-b-wins",
        "r3-no-advantage-24-24-both-set-point",
        "r3-no-advantage-24-23-set-point-a",
        "r4-single-set-ignores-tie-break",
        "r4-single-set-15-0-does-not-end",
        "r4-md3-set-1-regular",
        "r4-md3-set-2-regular",
        "r4-md3-set-3-tie-break",
        "r4-md5-set-1-regular",
        "r4-md5-set-2-regular",
        "r4-md5-set-3-regular",
        "r4-md5-set-4-regular",
        "r4-md5-set-5-tie-break",
        "r4-md3-tie-break-off",
        "r4-tie-break-above-points",
        "r5-tie-break-15-13-a-wins",
        "r5-tie-break-15-14-set-point-a",
        "r5-tie-break-14-14",
        "r5-tie-break-16-14-a-wins",
        "r5-set-2-15-13-does-not-end",
        "r6-target-1-m1-0-0-both-set-point",
        "r6-target-1-m1-1-0-a-wins",
        "r6-target-1-m2-0-0",
        "r6-target-1-m2-1-0-set-point-a",
        "r6-target-1-m2-1-1",
        "r6-target-1-m2-2-0-a-wins",
        "r7-md1-1-0-a",
        "r7-md1-0-1-b",
        "r7-md1-0-0-none",
        "r7-md3-1-0-none",
        "r7-md3-1-1-none",
        "r7-md3-2-0-a",
        "r7-md3-1-2-b",
        "r7-md5-2-2-none",
        "r7-md5-3-2-a",
        "r7-md5-2-3-b",
    ];

    private static readonly HashSet<string> CaseFields = ["id", "scoring", "setNumber", "score", "setsWon", "expected"];
    private static readonly HashSet<string> ScoringFields = ["bestOf", "pointsPerSet", "tieBreakPoints", "winMargin"];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("score-rules.json");

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
    public void Rules_MatchTheGoldenCase(string id)
    {
        var goldenCase = GoldenFile.SingleCase(Cases, GoldenFile.IdOf, id);
        GoldenFile.AssertOnlyFields(goldenCase, CaseFields, id);
        var scoring = ScoringOf(goldenCase.GetProperty("scoring"), id);
        var setNumber = CourtSessionGoldenReader.Integer(goldenCase.GetProperty("setNumber"), id);
        var score = CourtSessionGoldenReader.Pair(goldenCase.GetProperty("score"), id);
        BySide<int>? setsWon = goldenCase.TryGetProperty("setsWon", out var rawSetsWon)
            ? CourtSessionGoldenReader.Pair(rawSetsWon, id)
            : null;

        var targetPoints = ScoreRules.TargetPointsForSet(scoring, setNumber);

        OrderedJsonAssert.Equal(goldenCase.GetProperty("expected"), writer =>
        {
            writer.WriteStartObject();
            writer.WriteNumber("targetPoints", targetPoints);
            writer.WriteNumber("setsToWin", ScoreRules.SetsToWin(scoring.BestOf));
            writer.WritePropertyName("setWinner");
            CourtSessionGoldenReader.WriteSide(writer, ScoreRules.GetSetWinner(score, targetPoints, scoring.WinMargin));
            writer.WritePropertyName("setPointTeams");
            CourtSessionGoldenReader.WriteTexts(
                writer, ScoreRules.GetSetPointTeams(score, targetPoints, scoring.WinMargin).Select(side => side.Code));
            if (setsWon is not null)
            {
                writer.WritePropertyName("matchWinner");
                CourtSessionGoldenReader.WriteSide(writer, ScoreRules.GetMatchWinner(setsWon, scoring.BestOf));
            }

            writer.WriteEndObject();
        }, id);
    }

    private static ScoringRules ScoringOf(JsonElement scoring, string id)
    {
        GoldenFile.AssertOnlyFields(scoring, ScoringFields, id);
        var tieBreakPoints = scoring.GetProperty("tieBreakPoints");
        return new ScoringRules(
            CourtSessionGoldenReader.Integer(scoring.GetProperty("bestOf"), id),
            CourtSessionGoldenReader.Integer(scoring.GetProperty("pointsPerSet"), id),
            tieBreakPoints.ValueKind == JsonValueKind.Null ? null : CourtSessionGoldenReader.Integer(tieBreakPoints, id),
            CourtSessionGoldenReader.Integer(scoring.GetProperty("winMargin"), id));
    }
}
