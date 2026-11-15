using System.Text.Json;
using Sacou.Modules.Matches.Domain.CourtSessions.Queue;

namespace Sacou.Modules.Matches.CourtSessionJson;

/// <summary>
/// Writes the next match plan with the text <c>JSON.stringify</c> gives in TypeScript: keys by fixed
/// lists in the order of ADR 0050, <c>null</c> and <c>[]</c> always written (ADR 0033, D6). Text is
/// escaped as in <see cref="CourtSessionStateWriter"/>.
/// </summary>
internal static class NextMatchPlanWriter
{
    /// <summary>The members of the plan, without the braces, so that a caller may put a key before them.</summary>
    public static void WriteFields(Utf8JsonWriter writer, NextMatchPlan plan)
    {
        ArgumentNullException.ThrowIfNull(writer);
        ArgumentNullException.ThrowIfNull(plan);
        writer.WriteStartArray("enteringTeams");
        foreach (var side in plan.EnteringTeams)
        {
            writer.WriteStringValue(side.Code);
        }

        writer.WriteEndArray();
        writer.WriteStartArray("exits");
        foreach (var exit in plan.Exits)
        {
            WriteExit(writer, exit);
        }

        writer.WriteEndArray();
        writer.WritePropertyName("queue");
        CourtSessionStateWriter.WriteQueue(writer, plan.Queue);
        writer.WritePropertyName("rotations");
        writer.WriteStartObject();
        writer.WritePropertyName("a");
        CourtSessionStateWriter.WriteTeamState(writer, plan.Rotations.A);
        writer.WritePropertyName("b");
        CourtSessionStateWriter.WriteTeamState(writer, plan.Rotations.B);
        writer.WriteEndObject();
        writer.WritePropertyName("teams");
        writer.WriteStartObject();
        writer.WritePropertyName("a");
        CourtSessionStateWriter.WriteRoster(writer, plan.Teams.A);
        writer.WritePropertyName("b");
        CourtSessionStateWriter.WriteRoster(writer, plan.Teams.B);
        writer.WriteEndObject();
        writer.WritePropertyName("winnerLeaving");
        WriteWinnerLeaving(writer, plan.WinnerLeaving);
    }

    /// <summary>The members of a refusal: its code and, for an invalid payload, its field.</summary>
    public static void WriteErrorFields(Utf8JsonWriter writer, QueueCommandError error)
    {
        ArgumentNullException.ThrowIfNull(writer);
        ArgumentNullException.ThrowIfNull(error);
        writer.WriteString("code", error.Code);
        if (error.Field is { } field)
        {
            writer.WriteString("field", field);
        }
    }

    private static void WriteExit(Utf8JsonWriter writer, PartialExit exit)
    {
        writer.WriteStartObject();
        writer.WriteNumber("consecutiveMatches", exit.ConsecutiveMatches);
        CourtSessionStateWriter.WriteText(writer, "incoming", exit.Incoming);
        CourtSessionStateWriter.WriteText(writer, "outgoing", exit.Outgoing);
        writer.WritePropertyName("place");
        writer.WriteStartObject();
        writer.WriteString("area", exit.Place.Area);
        if (exit.Place.Index is { } index)
        {
            writer.WriteNumber("index", index);
        }

        writer.WriteEndObject();
        writer.WriteString("side", exit.Side.Code);
        writer.WriteEndObject();
    }

    private static void WriteWinnerLeaving(Utf8JsonWriter writer, WinnerLeaving? winnerLeaving)
    {
        if (winnerLeaving is null)
        {
            writer.WriteNullValue();
            return;
        }

        writer.WriteStartObject();
        writer.WriteString("side", winnerLeaving.Side.Code);
        writer.WriteNumber("streak", winnerLeaving.Streak);
        writer.WriteEndObject();
    }
}
