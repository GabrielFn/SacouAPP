using System.Text.Json;
using Sacou.Modules.Matches.Domain.CourtSessions.Queue;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Score;

/// <summary>
/// Writes a parsed payload back as JSON, so a test can compare it with the payload it came from, as
/// <c>toStrictEqual({ ok: true, value: payload })</c> does in TypeScript. Test only: the production
/// writer of the state is the next part.
/// </summary>
internal static class ScorePayloadJson
{
    public static void Write(Utf8JsonWriter writer, ScorePayload payload)
    {
        writer.WriteStartObject();
        switch (payload)
        {
            case MatchStartedPayload started:
                writer.WriteString("firstServer", started.FirstServer.Code);
                writer.WriteNumber("formationsVersion", started.FormationsVersion);
                writer.WriteString("matchId", started.MatchId);
                writer.WritePropertyName("queue");
                WriteQueue(writer, started.Queue);
                writer.WritePropertyName("rotations");
                WriteRotations(writer, started.Rotations);
                writer.WriteNumber("rulesVersion", started.RulesVersion);
                writer.WritePropertyName("scoring");
                WriteScoring(writer, started.Scoring);
                writer.WritePropertyName("teams");
                WriteTeams(writer, started.Teams);
                break;
            case PointScoredPayload point:
                writer.WriteString("matchId", point.MatchId);
                writer.WriteNumber("setNumber", point.SetNumber);
                writer.WriteString("team", point.Team.Code);
                break;
            case SetEndedPayload setEnded:
                writer.WriteString("matchId", setEnded.MatchId);
                writer.WritePropertyName("nextSet");
                WriteNextSet(writer, setEnded.NextSet);
                writer.WriteNumber("setNumber", setEnded.SetNumber);
                writer.WriteString("winner", setEnded.Winner.Code);
                break;
            case MatchEndedPayload matchEnded:
                writer.WriteString("endReason", matchEnded.EndReason.Code);
                writer.WriteString("matchId", matchEnded.MatchId);
                WriteNullableText(writer, "winner", matchEnded.Winner?.Code);
                break;
            case LineupChangedPayload lineup:
                WriteTexts(writer, "bench", lineup.Bench);
                writer.WritePropertyName("libero");
                WriteLibero(writer, lineup.Libero);
                WriteTexts(writer, "lineup", lineup.Lineup);
                writer.WriteString("matchId", lineup.MatchId);
                writer.WriteNumber("setterZone", lineup.SetterZone);
                writer.WriteString("team", lineup.Team.Code);
                break;
            case QueueChangedPayload queue:
                writer.WriteString("matchId", queue.MatchId);
                writer.WritePropertyName("queue");
                WriteQueue(writer, queue.Queue);
                break;
            case ServingTeamChangedPayload serving:
                writer.WriteString("firstServer", serving.FirstServer.Code);
                writer.WriteString("matchId", serving.MatchId);
                writer.WriteString("servingTeam", serving.ServingTeam.Code);
                writer.WriteNumber("setNumber", serving.SetNumber);
                break;
            case PointAttributedPayload attributed:
                WriteNullableText(writer, "author", attributed.Author);
                writer.WriteString("kind", attributed.Kind.Code);
                writer.WriteString("matchId", attributed.MatchId);
                writer.WriteString("pointEventId", attributed.PointEventId);
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(payload), "Unknown payload.");
        }

        writer.WriteEndObject();
    }

    private static void WriteScoring(Utf8JsonWriter writer, ScoringRules scoring)
    {
        writer.WriteStartObject();
        writer.WriteNumber("bestOf", scoring.BestOf);
        writer.WriteNumber("pointsPerSet", scoring.PointsPerSet);
        writer.WritePropertyName("tieBreakPoints");
        WriteNullableNumber(writer, scoring.TieBreakPoints);
        writer.WriteNumber("winMargin", scoring.WinMargin);
        writer.WriteEndObject();
    }

    private static void WriteTeams(Utf8JsonWriter writer, BySide<TeamRoster> teams)
    {
        writer.WriteStartObject();
        writer.WritePropertyName("a");
        WriteRoster(writer, teams.A);
        writer.WritePropertyName("b");
        WriteRoster(writer, teams.B);
        writer.WriteEndObject();
    }

    private static void WriteRoster(Utf8JsonWriter writer, TeamRoster roster)
    {
        writer.WriteStartObject();
        WriteTexts(writer, "memberIds", roster.MemberIds);
        writer.WriteEndObject();
    }

    private static void WriteRotations(Utf8JsonWriter writer, BySide<TeamState?> rotations)
    {
        writer.WriteStartObject();
        writer.WritePropertyName("a");
        WriteTeamState(writer, rotations.A);
        writer.WritePropertyName("b");
        WriteTeamState(writer, rotations.B);
        writer.WriteEndObject();
    }

    private static void WriteTeamState(Utf8JsonWriter writer, TeamState? state)
    {
        if (state is null)
        {
            writer.WriteNullValue();
            return;
        }

        writer.WriteStartObject();
        WriteTexts(writer, "bench", state.Bench);
        writer.WritePropertyName("libero");
        WriteLibero(writer, state.Libero);
        WriteTexts(writer, "lineup", state.Lineup);
        writer.WriteNumber("setterZone", state.SetterZone);
        writer.WriteString("system", state.System.Code);
        writer.WriteEndObject();
    }

    private static void WriteLibero(Utf8JsonWriter writer, TeamLibero? libero)
    {
        if (libero is null)
        {
            writer.WriteNullValue();
            return;
        }

        writer.WriteStartObject();
        writer.WriteString("memberId", libero.MemberId);
        writer.WriteStartArray("replacedIndexes");
        foreach (var index in libero.ReplacedIndexes)
        {
            writer.WriteNumberValue(index);
        }

        writer.WriteEndArray();
        writer.WriteEndObject();
    }

    private static void WriteQueue(Utf8JsonWriter writer, TeamQueue queue)
    {
        writer.WriteStartObject();
        WriteTexts(writer, "players", queue.Players);
        writer.WriteStartArray("teams");
        foreach (var team in queue.Teams)
        {
            WriteRoster(writer, team);
        }

        writer.WriteEndArray();
        writer.WriteEndObject();
    }

    private static void WriteNextSet(Utf8JsonWriter writer, NextSet? nextSet)
    {
        if (nextSet is null)
        {
            writer.WriteNullValue();
            return;
        }

        writer.WriteStartObject();
        writer.WriteString("firstServer", nextSet.FirstServer.Code);
        writer.WriteStartObject("setterZones");
        writer.WritePropertyName("a");
        WriteNullableNumber(writer, nextSet.SetterZones.A);
        writer.WritePropertyName("b");
        WriteNullableNumber(writer, nextSet.SetterZones.B);
        writer.WriteEndObject();
        writer.WriteNumber("targetPoints", nextSet.TargetPoints);
        writer.WriteEndObject();
    }

    private static void WriteTexts(Utf8JsonWriter writer, string key, IEnumerable<string> texts)
    {
        writer.WriteStartArray(key);
        foreach (var text in texts)
        {
            writer.WriteStringValue(text);
        }

        writer.WriteEndArray();
    }

    private static void WriteNullableText(Utf8JsonWriter writer, string key, string? text)
    {
        if (text is null)
        {
            writer.WriteNull(key);
            return;
        }

        writer.WriteString(key, text);
    }

    private static void WriteNullableNumber(Utf8JsonWriter writer, int? number)
    {
        if (number is { } value)
        {
            writer.WriteNumberValue(value);
            return;
        }

        writer.WriteNullValue();
    }
}
