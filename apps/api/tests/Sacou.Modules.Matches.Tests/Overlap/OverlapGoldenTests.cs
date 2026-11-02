using System.Text.Json;
using Sacou.Modules.Matches.Domain.Formations;
using Sacou.Modules.Matches.Domain.Overlap;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.Overlap;

public sealed class OverlapGoldenTests
{
    private const int GoldenCaseCount = 73;

    private static readonly string[] GoldenIds =
    [
        "T3-base-fivb-receiving",
        "T3-base-classic-receiving",
        "T3-base-classic-serving",
        "T3-base-fivb-serving",
        "T4-V1-fivb-receiving",
        "T4-V2-fivb-receiving",
        "T4-V3-fivb-receiving",
        "T4-V4-fivb-receiving",
        "T4-V5-fivb-receiving",
        "T4-V6-fivb-receiving",
        "T4-V7-fivb-receiving",
        "T4-V1-classic-receiving",
        "T4-V2-classic-receiving",
        "T4-V3-classic-receiving",
        "T4-V4-classic-receiving",
        "T4-V5-classic-receiving",
        "T4-V6-classic-receiving",
        "T4-V7-classic-receiving",
        "T5-V2-classic-serving",
        "T5-V3-classic-serving",
        "T5-V4-classic-serving",
        "T5-V5-classic-serving",
        "T5-V6-classic-serving",
        "T6-V1-classic-serving",
        "T6-V7-classic-serving",
        "T7-V1-fivb-serving",
        "T7-V2-fivb-serving",
        "T7-V3-fivb-serving",
        "T7-V4-fivb-serving",
        "T7-V5-fivb-serving",
        "T7-V6-fivb-serving",
        "T7-V7-fivb-serving",
        "T8-depth-tie-1-2-tolerance-zero",
        "T8-depth-tie-1-2-default-tolerance",
        "T8-depth-tie-6-3-classic-serving",
        "T9-lateral-tie-allowed-tolerance-zero",
        "T9-lateral-tie-allowed-default-tolerance",
        "T9-lateral-tie-allowed-large-tolerance",
        "T10-default-tolerance-inside",
        "T10-default-tolerance-outside",
        "T11-explicit-zero-is-not-default",
        "T12-custom-tolerance-exact-limit",
        "T12-custom-tolerance-outside",
        "T13-tolerance-reaches-lateral",
        "T14-no-diagonal-relation",
        "T15-two-violations-in-fixed-order",
        "T16-outside-the-court-is-not-checked",
        "T16-negative-tolerance-receiving",
        "T16-negative-tolerance-fivb-serving",
        "T13-zero-tolerance-lateral-outside",
        "T19-lateral-limit-fivb-receiving",
        "T19-lateral-outside-fivb-receiving",
        "T19-lateral-limit-classic-receiving",
        "T19-lateral-outside-classic-receiving",
        "T19-lateral-limit-classic-serving",
        "T19-lateral-outside-classic-serving",
        "T20-depth-limit-classic-receiving",
        "T20-depth-outside-classic-receiving",
        "T20-depth-limit-classic-serving",
        "T20-depth-outside-classic-serving",
        "T20-depth-tie-classic-receiving-tolerance-zero",
        "T20-lateral-tie-classic-receiving-tolerance-zero",
        "T20-lateral-tie-classic-serving-tolerance-zero",
        "T21-default-tolerance-pinned-depth-inside",
        "T21-default-tolerance-pinned-depth-outside",
        "T21-default-tolerance-pinned-lateral-inside",
        "T21-default-tolerance-pinned-lateral-outside",
        "T22-exact-tie-5-behind-4",
        "T22-exact-tie-3-left-of-2",
        "T22-exact-tie-5-left-of-6",
        "T22-exact-tie-6-left-of-1",
        "T23-binary-rounding-depth",
        "T23-binary-rounding-lateral",
    ];

    private static readonly HashSet<string> CaseFields = ["id", "mode", "phase", "tolerance", "slots", "expected"];
    private static readonly HashSet<string> ExpectedFields = ["ok", "checked", "code", "violations"];
    private static readonly HashSet<string> SlotKeys = ["1", "2", "3", "4", "5", "6"];
    private static readonly HashSet<string> PointFields = ["x", "y"];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("overlap.json");

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
    public void Validate_MatchesTheGoldenCase(string id)
    {
        var goldenCase = GoldenFile.SingleCase(Cases, GoldenFile.IdOf, id);
        GoldenFile.AssertOnlyFields(goldenCase, CaseFields, id);
        var slots = goldenCase.GetProperty("slots");
        GoldenFile.AssertOnlyFields(slots, SlotKeys, id);
        foreach (var member in slots.EnumerateObject())
        {
            GoldenFile.AssertOnlyFields(member.Value, PointFields, id);
        }

        var result = OverlapValidator.Validate(
            OverlapTestData.PositionsFromGolden(slots, id),
            OverlapRuleMode.All.Single(mode => mode.Code == GoldenFile.Text(goldenCase, "mode")),
            FormationPhase.All.Single(phase => phase.Code == GoldenFile.Text(goldenCase, "phase")),
            ToleranceOf(goldenCase, id));

        AssertExpected(goldenCase.GetProperty("expected"), result, id);
    }

    private static double? ToleranceOf(JsonElement goldenCase, string id) =>
        goldenCase.TryGetProperty("tolerance", out var tolerance) ? GoldenFile.Number(tolerance, id) : null;

    private static void AssertExpected(JsonElement expected, OverlapResult result, string id)
    {
        GoldenFile.AssertOnlyFields(expected, ExpectedFields, id);
        if (expected.GetProperty("ok").GetBoolean())
        {
            OverlapTestData.AssertPassed(TextsOf(expected.GetProperty("checked")), result);
            return;
        }

        var code = GoldenFile.Text(expected, "code");
        if (code == "overlap")
        {
            OverlapTestData.AssertViolated(TextsOf(expected.GetProperty("violations")), result);
            return;
        }

        Assert.Equal("invalid-tolerance", code);
        Assert.IsType<OverlapResult.InvalidTolerance>(result);
    }

    private static List<string> TextsOf(JsonElement items) =>
        [.. items.EnumerateArray().Select(item => item.GetString()!)];
}
