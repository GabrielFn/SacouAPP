using System.Collections.Immutable;
using System.Text.Json;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.Formations;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions;

/// <summary>Reads the inputs of the match-engine golden files, by value objects and never by a shared table of names.</summary>
internal static class CourtSessionGoldenReader
{
    private static readonly HashSet<string> LiberoFields = ["memberId", "replacedIndexes"];

    public static int Integer(JsonElement value, string context)
    {
        var number = GoldenFile.Number(value, context);
        Assert.True(Math.Floor(number) == number, $"{context}: expected an integer.");
        return (int)number;
    }

    public static ImmutableArray<string> Texts(JsonElement items) =>
        [.. items.EnumerateArray().Select(item => item.GetString()!)];

    public static TeamSide Side(JsonElement value) => TeamSide.All.Single(side => side.Code == value.GetString());

    public static FormationSystem System(JsonElement value) =>
        FormationSystem.All.Single(system => system.Code == value.GetString());

    public static FormationPhase Phase(JsonElement value) =>
        FormationPhase.All.Single(phase => phase.Code == value.GetString());

    public static BySide<int> Pair(JsonElement value, string context) =>
        new(Integer(value.GetProperty("a"), context), Integer(value.GetProperty("b"), context));

    public static TeamLibero Libero(JsonElement value, string context)
    {
        GoldenFile.AssertOnlyFields(value, LiberoFields, context);
        return new TeamLibero(
            GoldenFile.Text(value, "memberId"),
            [.. value.GetProperty("replacedIndexes").EnumerateArray().Select(index => Integer(index, context))]);
    }

    public static void WriteSide(Utf8JsonWriter writer, TeamSide? side)
    {
        if (side is null)
        {
            writer.WriteNullValue();
            return;
        }

        writer.WriteStringValue(side.Code);
    }

    public static void WriteTexts(Utf8JsonWriter writer, string key, IEnumerable<string> texts)
    {
        writer.WritePropertyName(key);
        WriteTexts(writer, texts);
    }

    public static void WriteTexts(Utf8JsonWriter writer, IEnumerable<string> texts)
    {
        writer.WriteStartArray();
        foreach (var text in texts)
        {
            writer.WriteStringValue(text);
        }

        writer.WriteEndArray();
    }
}
