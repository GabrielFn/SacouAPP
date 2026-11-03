using System.Globalization;
using System.Text.Json;
using Sacou.Modules.Matches.Domain.CourtSessions.Alignment;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Domain.Formations;
using Sacou.Modules.Matches.FormationCatalogs;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Alignment;

/// <summary>What the serve and libero alignment golden files share: the input and the slots.</summary>
internal static class AlignmentGolden
{
    public static readonly FormationCatalog Catalog = EmbeddedFormationCatalog.Load();

    private static readonly HashSet<string> CaseFields = ["id", "input", "expected"];

    public static (TeamState TeamState, FormationPhase Phase) InputOf(JsonElement goldenCase, IReadOnlySet<string> inputFields, string id)
    {
        GoldenFile.AssertOnlyFields(goldenCase, CaseFields, id);
        var input = goldenCase.GetProperty("input");
        GoldenFile.AssertOnlyFields(input, inputFields, id);
        var libero = input.TryGetProperty("libero", out var rawLibero) ? CourtSessionGoldenReader.Libero(rawLibero, id) : null;
        var teamState = new TeamState(
            [],
            libero,
            CourtSessionGoldenReader.Texts(input.GetProperty("lineup")),
            CourtSessionGoldenReader.Integer(input.GetProperty("setterZone"), id),
            CourtSessionGoldenReader.System(input.GetProperty("system")));
        return (teamState, CourtSessionGoldenReader.Phase(input.GetProperty("phase")));
    }

    /// <summary>The alignment says back what it was asked, as <c>toMatchObject</c> checks in TypeScript.</summary>
    public static void AssertEchoesTheInput(ServeAlignment alignment, TeamState teamState, FormationPhase phase)
    {
        Assert.Equal(teamState.System, alignment.System);
        Assert.Equal(teamState.SetterZone, alignment.SetterZone);
        Assert.Equal(phase, alignment.Phase);
    }

    /// <summary>Slots keyed <c>"1"</c> to <c>"6"</c>, the order JavaScript gives integer keys.</summary>
    public static void WriteSlots(Utf8JsonWriter writer, ServeAlignment alignment)
    {
        writer.WriteStartObject("slots");
        foreach (var slot in alignment.Slots)
        {
            writer.WriteStartObject(slot.Slot.Value.ToString(CultureInfo.InvariantCulture));
            writer.WriteString("memberId", slot.MemberId);
            writer.WriteString("role", slot.Role.Code);
            writer.WriteStartObject("point");
            writer.WriteNumber("x", slot.Point.X);
            writer.WriteNumber("y", slot.Point.Y);
            writer.WriteEndObject();
            writer.WriteEndObject();
        }

        writer.WriteEndObject();
    }

    /// <summary>Equality by bits for the points, as ADR 0006 asks, on top of the comparison by value.</summary>
    public static void AssertPointsByBits(JsonElement expected, ServeAlignment alignment, string id)
    {
        var slots = expected.GetProperty("slots");
        foreach (var slot in alignment.Slots)
        {
            var point = slots.GetProperty(slot.Slot.Value.ToString(CultureInfo.InvariantCulture)).GetProperty("point");
            GoldenFile.AssertExact(GoldenFile.Number(point.GetProperty("x"), id), slot.Point.X, $"{id}/{slot.Slot.Value}/x");
            GoldenFile.AssertExact(GoldenFile.Number(point.GetProperty("y"), id), slot.Point.Y, $"{id}/{slot.Slot.Value}/y");
        }
    }
}
