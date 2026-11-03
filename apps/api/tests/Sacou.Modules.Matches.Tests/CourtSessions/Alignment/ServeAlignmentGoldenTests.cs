using System.Text.Json;
using Sacou.Modules.Matches.Domain.CourtSessions.Alignment;
using Sacou.Modules.Matches.Tests.CourtSessions.EventLog;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Alignment;

/// <summary>Port of <c>serve-alignment.golden.test.ts</c>, reading the same file.</summary>
public sealed class ServeAlignmentGoldenTests
{
    private const int GoldenCaseCount = 49;

    private static readonly string[] GoldenIds =
    [
        "5x1-zone-1-receiving",
        "5x1-zone-1-serving",
        "5x1-zone-6-receiving",
        "5x1-zone-6-serving",
        "5x1-zone-5-receiving",
        "5x1-zone-5-serving",
        "5x1-zone-4-receiving",
        "5x1-zone-4-serving",
        "5x1-zone-3-receiving",
        "5x1-zone-3-serving",
        "5x1-zone-2-receiving",
        "5x1-zone-2-serving",
        "6x2-zone-1-receiving",
        "6x2-zone-1-serving",
        "6x2-zone-6-receiving",
        "6x2-zone-6-serving",
        "6x2-zone-5-receiving",
        "6x2-zone-5-serving",
        "6x2-zone-4-receiving",
        "6x2-zone-4-serving",
        "6x2-zone-3-receiving",
        "6x2-zone-3-serving",
        "6x2-zone-2-receiving",
        "6x2-zone-2-serving",
        "4x2-zone-1-receiving",
        "4x2-zone-1-serving",
        "4x2-zone-6-receiving",
        "4x2-zone-6-serving",
        "4x2-zone-5-receiving",
        "4x2-zone-5-serving",
        "4x2-zone-4-receiving",
        "4x2-zone-4-serving",
        "4x2-zone-3-receiving",
        "4x2-zone-3-serving",
        "4x2-zone-2-receiving",
        "4x2-zone-2-serving",
        "livre-zone-1-receiving",
        "livre-zone-1-serving",
        "livre-zone-6-receiving",
        "livre-zone-6-serving",
        "livre-zone-5-receiving",
        "livre-zone-5-serving",
        "livre-zone-4-receiving",
        "livre-zone-4-serving",
        "livre-zone-3-receiving",
        "livre-zone-3-serving",
        "livre-zone-2-receiving",
        "livre-zone-2-serving",
        "6x2-zone-3-receiving-lineup-out-of-uuid-order",
    ];

    private static readonly HashSet<string> InputFields = ["system", "lineup", "setterZone", "phase"];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("serve-alignment.json");

    public static TheoryData<string> CaseIds => new(GoldenIds);

    [Fact]
    public void GoldenList_HasTheExactTotal()
    {
        Assert.Equal(GoldenCaseCount, GoldenIds.Length);
    }

    /// <summary>In order, as the TypeScript test asks.</summary>
    [Fact]
    public void GoldenList_IsTheFile_InOrder()
    {
        Assert.Equal(GoldenIds, Cases.Select(GoldenFile.IdOf));
    }

    [Theory]
    [MemberData(nameof(CaseIds))]
    public void Alignment_MatchesTheGoldenCase(string id)
    {
        var goldenCase = GoldenFile.SingleCase(Cases, GoldenFile.IdOf, id);
        var (teamState, phase) = AlignmentGolden.InputOf(goldenCase, InputFields, id);
        var expected = goldenCase.GetProperty("expected");

        var alignment = ServeAlignmentRules.GetServeAlignment(AlignmentGolden.Catalog, teamState, phase);

        OrderedJsonAssert.Equal(expected, writer =>
        {
            writer.WriteStartObject();
            writer.WriteNumber("formationKey", alignment.FormationKey.Value);
            writer.WriteString("actingSetter", alignment.ActingSetter);
            AlignmentGolden.WriteSlots(writer, alignment);
            writer.WriteEndObject();
        }, id);
        AlignmentGolden.AssertPointsByBits(expected, alignment, id);
        AlignmentGolden.AssertEchoesTheInput(alignment, teamState, phase);
    }
}
