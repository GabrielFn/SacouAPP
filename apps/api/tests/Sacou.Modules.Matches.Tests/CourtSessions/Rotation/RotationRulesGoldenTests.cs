using System.Text.Json;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Tests.CourtSessions.EventLog;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Rotation;

/// <summary>Port of the "rotation rules golden" of <c>rotation.golden.test.ts</c>, reading the same file.</summary>
public sealed class RotationRulesGoldenTests
{
    private const int GoldenCaseCount = 18;

    private static readonly string[] GoldenIds =
    [
        "zone-1-next-6",
        "zone-6-next-5",
        "zone-5-next-4",
        "zone-4-next-3",
        "zone-3-next-2",
        "zone-2-next-1",
        "side-out-a-serving-b-wins",
        "side-out-b-serving-a-wins",
        "no-side-out-a-serving-a-wins",
        "no-side-out-b-serving-b-wins",
        "next-first-server-after-a",
        "next-first-server-after-b",
        "zone-1-previous-2",
        "zone-2-previous-3",
        "zone-3-previous-4",
        "zone-4-previous-5",
        "zone-5-previous-6",
        "zone-6-previous-1",
    ];

    private static readonly HashSet<string> CaseFields = ["id", "rule", "input", "expected"];
    private static readonly HashSet<string> ZoneInput = ["lineup", "setterZone"];
    private static readonly HashSet<string> SideOutInput = ["servingTeam", "pointWinner"];
    private static readonly HashSet<string> FirstServerInput = ["firstServer"];
    private static readonly HashSet<string> PreviousZoneInput = ["setterZone"];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("rotation-rules.json");

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
    public void Rule_MatchesTheGoldenCase(string id)
    {
        var goldenCase = GoldenFile.SingleCase(Cases, GoldenFile.IdOf, id);
        GoldenFile.AssertOnlyFields(goldenCase, CaseFields, id);
        var input = goldenCase.GetProperty("input");

        OrderedJsonAssert.Equal(goldenCase.GetProperty("expected"), writer =>
        {
            writer.WriteStartObject();
            WriteOutcome(writer, GoldenFile.Text(goldenCase, "rule"), input, id);
            writer.WriteEndObject();
        }, id);
    }

    private static void WriteOutcome(Utf8JsonWriter writer, string rule, JsonElement input, string id)
    {
        switch (rule)
        {
            case "zone":
                GoldenFile.AssertOnlyFields(input, ZoneInput, id);
                var lineup = CourtSessionGoldenReader.Texts(input.GetProperty("lineup"));
                var setterZone = CourtSessionGoldenReader.Integer(input.GetProperty("setterZone"), id);
                writer.WriteNumber("nextSetterZone", RotationRules.NextSetterZone(setterZone));
                writer.WritePropertyName("lineupBySlot");
                CourtSessionGoldenReader.WriteTexts(writer, RotationRules.GetLineupBySlot(lineup, setterZone));
                writer.WriteString("servingPlayer", RotationRules.GetServingPlayer(lineup, setterZone));
                break;
            case "side-out":
                GoldenFile.AssertOnlyFields(input, SideOutInput, id);
                writer.WriteBoolean("isSideOut", RotationRules.IsSideOut(
                    CourtSessionGoldenReader.Side(input.GetProperty("servingTeam")),
                    CourtSessionGoldenReader.Side(input.GetProperty("pointWinner"))));
                break;
            case "next-first-server":
                GoldenFile.AssertOnlyFields(input, FirstServerInput, id);
                writer.WriteString(
                    "firstServer",
                    RotationRules.GetNextSetFirstServer(CourtSessionGoldenReader.Side(input.GetProperty("firstServer"))).Code);
                break;
            case "previous-zone":
                GoldenFile.AssertOnlyFields(input, PreviousZoneInput, id);
                writer.WriteNumber(
                    "previousSetterZone",
                    RotationRules.PreviousSetterZone(CourtSessionGoldenReader.Integer(input.GetProperty("setterZone"), id)));
                break;
            default:
                Assert.Fail($"{id}: unknown rule.");
                break;
        }
    }
}
