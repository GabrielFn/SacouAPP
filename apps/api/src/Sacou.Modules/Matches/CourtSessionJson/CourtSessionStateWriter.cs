using System.Buffers;
using System.Globalization;
using System.Text;
using System.Text.Json;
using Sacou.Modules.Matches.Domain.CourtSessions.Queue;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;

namespace Sacou.Modules.Matches.CourtSessionJson;

/// <summary>
/// Writes the court session state with the text <c>JSON.stringify</c> gives in TypeScript: keys by
/// fixed lists in the order of each ADR, <c>null</c> and <c>[]</c> always written, never a
/// serializer nor an enumerated dictionary (ADR 0033, D6). Text is escaped as
/// <c>JSON.stringify</c> does, lone surrogates included, which <see cref="Utf8JsonWriter"/> refuses.
/// </summary>
internal static class CourtSessionStateWriter
{
    private const char Quote = '"';
    private const char Backslash = '\\';
    private const char FirstPrintable = ' ';
    private const string UnicodeEscapeFormat = "x4";

    public static string ToJson(CourtSessionState state)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer))
        {
            Write(writer, state);
        }

        return Encoding.UTF8.GetString(buffer.WrittenSpan);
    }

    public static void Write(Utf8JsonWriter writer, CourtSessionState state)
    {
        ArgumentNullException.ThrowIfNull(writer);
        ArgumentNullException.ThrowIfNull(state);
        writer.WriteStartObject();
        writer.WritePropertyName("currentMatch");
        if (state.CurrentMatch is { } match)
        {
            writer.WriteStartObject();
            WriteMatchFields(writer, match, finished: null);
            writer.WriteEndObject();
        }
        else
        {
            writer.WriteNullValue();
        }

        writer.WriteStartArray("finishedMatches");
        foreach (var finished in state.FinishedMatches)
        {
            writer.WriteStartObject();
            WriteMatchFields(writer, finished.Match, finished);
            writer.WriteEndObject();
        }

        writer.WriteEndArray();
        writer.WritePropertyName("queue");
        WriteQueue(writer, state.Queue);
        writer.WriteEndObject();
    }

    /// <summary>The text of a JSON string as <c>JSON.stringify</c> writes it, quotes included.</summary>
    public static string QuoteText(string text)
    {
        ArgumentNullException.ThrowIfNull(text);
        var builder = new StringBuilder(text.Length + 2);
        builder.Append(Quote);
        for (var index = 0; index < text.Length; index++)
        {
            AppendEscaped(builder, text, index);
        }

        return builder.Append(Quote).ToString();
    }

    /// <summary>A finished match puts its end reason and winner among the keys of the match, in order.</summary>
    private static void WriteMatchFields(Utf8JsonWriter writer, MatchScore match, FinishedMatch? finished)
    {
        writer.WriteStartArray("completedSets");
        foreach (var set in match.CompletedSets)
        {
            writer.WriteStartObject();
            writer.WritePropertyName("score");
            WritePair(writer, set.Score);
            writer.WriteNumber("setNumber", set.SetNumber);
            WriteText(writer, "winner", set.Winner.Code);
            writer.WriteEndObject();
        }

        writer.WriteEndArray();
        writer.WritePropertyName("currentSet");
        WriteCurrentSet(writer, match.CurrentSet);
        if (finished is not null)
        {
            WriteText(writer, "endReason", finished.EndReason.Code);
        }

        writer.WriteNumber("formationsVersion", match.FormationsVersion);
        WriteText(writer, "matchId", match.MatchId);
        writer.WritePropertyName("rotations");
        writer.WriteStartObject();
        writer.WritePropertyName("a");
        WriteTeamState(writer, match.Rotations.A);
        writer.WritePropertyName("b");
        WriteTeamState(writer, match.Rotations.B);
        writer.WriteEndObject();
        writer.WriteNumber("rulesVersion", match.RulesVersion);
        writer.WritePropertyName("scoring");
        WriteScoring(writer, match.Scoring);
        writer.WritePropertyName("setsWon");
        WritePair(writer, match.SetsWon);
        writer.WritePropertyName("teams");
        writer.WriteStartObject();
        writer.WritePropertyName("a");
        WriteRoster(writer, match.Teams.A);
        writer.WritePropertyName("b");
        WriteRoster(writer, match.Teams.B);
        writer.WriteEndObject();
        if (finished is not null)
        {
            writer.WritePropertyName("winner");
            WriteNullableText(writer, finished.Winner?.Code);
        }
    }

    private static void WriteCurrentSet(Utf8JsonWriter writer, MatchSet? set)
    {
        if (set is null)
        {
            writer.WriteNullValue();
            return;
        }

        writer.WriteStartObject();
        WriteText(writer, "firstServer", set.FirstServer.Code);
        writer.WritePropertyName("score");
        WritePair(writer, set.Score);
        WriteText(writer, "servingTeam", set.ServingTeam.Code);
        writer.WriteNumber("setNumber", set.SetNumber);
        writer.WriteNumber("targetPoints", set.TargetPoints);
        writer.WriteEndObject();
    }

    private static void WriteTeamState(Utf8JsonWriter writer, TeamState? teamState)
    {
        if (teamState is null)
        {
            writer.WriteNullValue();
            return;
        }

        writer.WriteStartObject();
        WriteTexts(writer, "bench", teamState.Bench);
        writer.WritePropertyName("libero");
        if (teamState.Libero is { } libero)
        {
            writer.WriteStartObject();
            WriteText(writer, "memberId", libero.MemberId);
            writer.WriteStartArray("replacedIndexes");
            foreach (var index in libero.ReplacedIndexes)
            {
                writer.WriteNumberValue(index);
            }

            writer.WriteEndArray();
            writer.WriteEndObject();
        }
        else
        {
            writer.WriteNullValue();
        }

        WriteTexts(writer, "lineup", teamState.Lineup);
        writer.WriteNumber("setterZone", teamState.SetterZone);
        WriteText(writer, "system", teamState.System.Code);
        writer.WriteEndObject();
    }

    private static void WriteScoring(Utf8JsonWriter writer, ScoringRules scoring)
    {
        writer.WriteStartObject();
        writer.WriteNumber("bestOf", scoring.BestOf);
        writer.WriteNumber("pointsPerSet", scoring.PointsPerSet);
        writer.WritePropertyName("tieBreakPoints");
        if (scoring.TieBreakPoints is { } tieBreakPoints)
        {
            writer.WriteNumberValue(tieBreakPoints);
        }
        else
        {
            writer.WriteNullValue();
        }

        writer.WriteNumber("winMargin", scoring.WinMargin);
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

    private static void WriteRoster(Utf8JsonWriter writer, TeamRoster roster)
    {
        writer.WriteStartObject();
        WriteTexts(writer, "memberIds", roster.MemberIds);
        writer.WriteEndObject();
    }

    private static void WritePair(Utf8JsonWriter writer, BySide<int> pair)
    {
        writer.WriteStartObject();
        writer.WriteNumber("a", pair.A);
        writer.WriteNumber("b", pair.B);
        writer.WriteEndObject();
    }

    private static void WriteTexts(Utf8JsonWriter writer, string key, IEnumerable<string> texts)
    {
        writer.WriteStartArray(key);
        foreach (var text in texts)
        {
            WriteTextValue(writer, text);
        }

        writer.WriteEndArray();
    }

    private static void WriteText(Utf8JsonWriter writer, string key, string text)
    {
        writer.WritePropertyName(key);
        WriteTextValue(writer, text);
    }

    private static void WriteNullableText(Utf8JsonWriter writer, string? text)
    {
        if (text is null)
        {
            writer.WriteNullValue();
            return;
        }

        WriteTextValue(writer, text);
    }

    private static void WriteTextValue(Utf8JsonWriter writer, string text) => writer.WriteRawValue(QuoteText(text));

    /// <summary>
    /// The escapes of <c>JSON.stringify</c>: quote, backslash and the short forms; any other control
    /// character and any lone surrogate as a lowercase <c>\u</c>; everything else as it is.
    /// </summary>
    private static void AppendEscaped(StringBuilder builder, string text, int index)
    {
        var character = text[index];
        var escaped = character switch
        {
            Quote => "\\\"",
            Backslash => "\\\\",
            '\b' => "\\b",
            '\f' => "\\f",
            '\n' => "\\n",
            '\r' => "\\r",
            '\t' => "\\t",
            _ when character < FirstPrintable || IsLoneSurrogate(text, index) => UnicodeEscape(character),
            _ => null,
        };
        if (escaped is null)
        {
            builder.Append(character);
            return;
        }

        builder.Append(escaped);
    }

    private static bool IsLoneSurrogate(string text, int index)
    {
        var character = text[index];
        if (char.IsHighSurrogate(character))
        {
            return index + 1 >= text.Length || !char.IsLowSurrogate(text[index + 1]);
        }

        return char.IsLowSurrogate(character) && (index == 0 || !char.IsHighSurrogate(text[index - 1]));
    }

    private static string UnicodeEscape(char character) =>
        @"\u" + ((int)character).ToString(UnicodeEscapeFormat, CultureInfo.InvariantCulture);
}
