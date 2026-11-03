using System.Text.Json;
using Sacou.Modules.Matches.Domain.CourtSessions.Alignment;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Tests.CourtSessions.EventLog;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Alignment;

/// <summary>Port of <c>libero-alignment.golden.test.ts</c>, reading the same file.</summary>
public sealed class LiberoAlignmentGoldenTests
{
    private const int GoldenCaseCount = 48;

    private static readonly string[] GoldenIds =
    [
        "5x1-middles-zone-1-receiving",
        "5x1-middles-zone-1-serving",
        "5x1-middles-zone-6-receiving",
        "5x1-middles-zone-6-serving",
        "5x1-middles-zone-5-receiving",
        "5x1-middles-zone-5-serving",
        "5x1-middles-zone-4-receiving",
        "5x1-middles-zone-4-serving",
        "5x1-middles-zone-3-receiving",
        "5x1-middles-zone-3-serving",
        "5x1-middles-zone-2-receiving",
        "5x1-middles-zone-2-serving",
        "6x2-middles-zone-1-receiving",
        "6x2-middles-zone-1-serving",
        "6x2-middles-zone-6-receiving",
        "6x2-middles-zone-6-serving",
        "6x2-middles-zone-5-receiving",
        "6x2-middles-zone-5-serving",
        "6x2-middles-zone-4-receiving",
        "6x2-middles-zone-4-serving",
        "6x2-middles-zone-3-receiving",
        "6x2-middles-zone-3-serving",
        "6x2-middles-zone-2-receiving",
        "6x2-middles-zone-2-serving",
        "5x1-mb2-only-zone-1-receiving",
        "5x1-mb2-only-zone-1-serving",
        "5x1-mb2-only-zone-6-receiving",
        "5x1-mb2-only-zone-6-serving",
        "5x1-mb2-only-zone-5-receiving",
        "5x1-mb2-only-zone-5-serving",
        "5x1-mb2-only-zone-4-receiving",
        "5x1-mb2-only-zone-4-serving",
        "5x1-mb2-only-zone-3-receiving",
        "5x1-mb2-only-zone-3-serving",
        "5x1-mb2-only-zone-2-receiving",
        "5x1-mb2-only-zone-2-serving",
        "5x1-oh2-only-zone-1-receiving",
        "5x1-oh2-only-zone-1-serving",
        "5x1-oh2-only-zone-6-receiving",
        "5x1-oh2-only-zone-6-serving",
        "5x1-oh2-only-zone-5-receiving",
        "5x1-oh2-only-zone-5-serving",
        "5x1-oh2-only-zone-4-receiving",
        "5x1-oh2-only-zone-4-serving",
        "5x1-oh2-only-zone-3-receiving",
        "5x1-oh2-only-zone-3-serving",
        "5x1-oh2-only-zone-2-receiving",
        "5x1-oh2-only-zone-2-serving",
    ];

    private static readonly HashSet<string> InputFields = ["system", "lineup", "setterZone", "phase", "libero"];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("libero-alignment.json");

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
        var liberoSlot = LiberoRules.GetLiberoSlot(teamState, phase);

        OrderedJsonAssert.Equal(expected, writer =>
        {
            writer.WriteStartObject();
            writer.WriteNumber("formationKey", alignment.FormationKey.Value);
            writer.WriteString("actingSetter", alignment.ActingSetter);
            writer.WritePropertyName("liberoSlot");
            if (liberoSlot is null)
            {
                writer.WriteNullValue();
            }
            else
            {
                writer.WriteNumberValue(liberoSlot.Value);
            }

            AlignmentGolden.WriteSlots(writer, alignment);
            writer.WriteEndObject();
        }, id);
        AlignmentGolden.AssertPointsByBits(expected, alignment, id);
        AlignmentGolden.AssertEchoesTheInput(alignment, teamState, phase);
    }
}
