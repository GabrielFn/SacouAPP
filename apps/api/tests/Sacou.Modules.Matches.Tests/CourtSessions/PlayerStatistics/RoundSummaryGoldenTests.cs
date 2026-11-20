using System.Collections.Immutable;
using System.Text.Json;
using Sacou.Modules.Matches.Domain.CourtSessions.PlayerStatistics;
using Sacou.Modules.Matches.Tests.CourtSessions.EventLog;
using Sacou.Modules.Matches.Tests.CourtSessions.Score;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.PlayerStatistics;

/// <summary>Port of <c>round-summary.golden.test.ts</c>, reading the same file. Equal exactly, key order included.</summary>
public sealed class RoundSummaryGoldenTests
{
    private const int GoldenCaseCount = 19;

    private static readonly string[] GoldenIds =
    [
        "r1-the-round-of-the-plan",
        "r2-the-balance-ties-and-the-share-of-wins-decides",
        "r3-then-the-longest-streak-decides",
        "r4-then-more-matches-decide-two-of-three-ties-four-of-six",
        "r5-then-the-first-appearance-decides-never-the-id",
        "r6-the-open-match-changes-nothing",
        "r7-empty-round-on-the-sand",
        "r8-mvp-off-keeps-the-players",
        "r9-mvp-by-stats-off-keeps-the-players",
        "r10-individual-points-off-zeroes-the-kinds",
        "r11-no-winner-is-not-a-win-in-the-share",
        "r12-beach-2x2-the-day-of-screen-12b",
        "r13-beach-ties-by-losses-then-streak",
        "r14-beach-ties-by-point-balance-then-first-match",
        "r15-beach-remade-pair-is-another-team",
        "r16-beach-4x4-with-a-team-of-three",
        "r17-tied-highlights-are-null",
        "r18-main-side-is-the-side-of-most-matches",
        "r19-main-side-on-a-tie-is-the-last-match",
    ];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("round-summary.json");

    public static TheoryData<string> CaseIds => new(GoldenIds);

    [Fact]
    public void GoldenList_HasTheExactTotal()
    {
        Assert.Equal(GoldenCaseCount, GoldenIds.Length);
    }

    [Fact]
    public void GoldenList_IsTheFile_InOrder()
    {
        Assert.Equal(GoldenIds, Cases.Select(GoldenFile.IdOf));
    }

    [Theory]
    [MemberData(nameof(CaseIds))]
    public void RoundSummary_MatchesTheGoldenCase(string id)
    {
        var goldenCase = GoldenFile.SingleCase(Cases, GoldenFile.IdOf, id);
        var timeline = ScoreEventsGolden.RunTimeline(goldenCase);
        Assert.NotNull(timeline);
        var options = OptionsOf(goldenCase.GetProperty("options"));

        OrderedJsonAssert.Equal(goldenCase.GetProperty("expected"), writer =>
        {
            writer.WriteStartObject();
            if (timeline.IsFailure)
            {
                writer.WriteBoolean("ok", false);
                writer.WriteString("code", timeline.Error.Code.Code);
                writer.WriteString("eventId", timeline.Error.EventId);
            }
            else
            {
                writer.WriteBoolean("ok", true);
                writer.WritePropertyName("roundSummary");
                RoundSummaryWriter.Write(writer, RoundSummaryRules.GetRoundSummary(timeline.Value, options));
            }

            writer.WriteEndObject();
        }, id);
    }

    private static RoundSummaryOptions OptionsOf(JsonElement options)
    {
        var modality = RoundModality.FromCode(GoldenFile.Text(options, "modality"));
        Assert.NotNull(modality);
        return new RoundSummaryOptions(
            modality,
            options.GetProperty("mvpEnabled").GetBoolean(),
            options.GetProperty("mvpByStats").GetBoolean(),
            options.GetProperty("individualPoints").GetBoolean());
    }
}

/// <summary>Writes a summary in the key order of the TypeScript contract.</summary>
internal static class RoundSummaryWriter
{
    public static void Write(Utf8JsonWriter writer, RoundSummary summary)
    {
        writer.WriteStartObject();
        writer.WriteNumber("mvpFormulaVersion", summary.MvpFormulaVersion);
        writer.WriteStartArray("finishedMatches");
        foreach (var match in summary.FinishedMatches)
        {
            WriteMatch(writer, match);
        }

        writer.WriteEndArray();
        writer.WriteStartArray("players");
        foreach (var player in summary.Players)
        {
            StatsEventsGoldenTests.WritePlayer(writer, player);
        }

        writer.WriteEndArray();
        WriteHighlights(writer, summary.Sides);
        writer.WritePropertyName("mvp");
        WriteMvp(writer, summary.Mvp);
        writer.WritePropertyName("ranking");
        WriteRanking(writer, summary.Ranking);
        writer.WriteEndObject();
    }

    private static void WriteMatch(Utf8JsonWriter writer, FinishedMatchResult match)
    {
        writer.WriteStartObject();
        writer.WriteString("matchId", match.MatchId);
        writer.WritePropertyName("winner");
        CourtSessionGoldenReader.WriteSide(writer, match.Winner);
        writer.WriteStartObject("teams");
        CourtSessionGoldenReader.WriteTexts(writer, "a", match.Teams.A);
        CourtSessionGoldenReader.WriteTexts(writer, "b", match.Teams.B);
        writer.WriteEndObject();
        writer.WriteStartObject("onCourt");
        CourtSessionGoldenReader.WriteTexts(writer, "a", match.OnCourt.A);
        CourtSessionGoldenReader.WriteTexts(writer, "b", match.OnCourt.B);
        writer.WriteEndObject();
        writer.WriteStartObject("points");
        writer.WriteNumber("a", match.Points.A);
        writer.WriteNumber("b", match.Points.B);
        writer.WriteEndObject();
        writer.WriteEndObject();
    }

    private static void WriteHighlights(Utf8JsonWriter writer, SideHighlights sides)
    {
        writer.WriteStartObject("sides");
        writer.WritePropertyName("mostWins");
        if (sides.MostWins is { } mostWins)
        {
            writer.WriteStartObject();
            writer.WriteString("side", mostWins.Side.Code);
            writer.WriteNumber("wins", mostWins.Wins);
            writer.WriteEndObject();
        }
        else
        {
            writer.WriteNullValue();
        }

        writer.WritePropertyName("longestStreak");
        if (sides.LongestStreak is { } longestStreak)
        {
            writer.WriteStartObject();
            writer.WriteString("side", longestStreak.Side.Code);
            writer.WriteNumber("longestWinStreak", longestStreak.LongestWinStreak);
            writer.WriteEndObject();
        }
        else
        {
            writer.WriteNullValue();
        }

        writer.WriteEndObject();
    }

    private static void WriteMvp(Utf8JsonWriter writer, DayMvp? mvp)
    {
        if (mvp is null)
        {
            writer.WriteNullValue();
            return;
        }

        writer.WriteStartObject();
        writer.WriteString("kind", mvp.Kind.Code);
        CourtSessionGoldenReader.WriteTexts(writer, "memberIds", mvp.MemberIds);
        writer.WritePropertyName("side");
        CourtSessionGoldenReader.WriteSide(writer, mvp.Side);
        writer.WriteNumber("matchesPlayed", mvp.MatchesPlayed);
        writer.WriteNumber("wins", mvp.Wins);
        writer.WriteNumber("plusMinus", mvp.PlusMinus);
        writer.WriteNumber("longestWinStreak", mvp.LongestWinStreak);
        writer.WriteEndObject();
    }

    private static void WriteRanking(Utf8JsonWriter writer, ImmutableArray<BeachTeamStanding>? ranking)
    {
        if (ranking is not { } standings)
        {
            writer.WriteNullValue();
            return;
        }

        writer.WriteStartArray();
        foreach (var standing in standings)
        {
            writer.WriteStartObject();
            CourtSessionGoldenReader.WriteTexts(writer, "memberIds", standing.MemberIds);
            writer.WriteNumber("wins", standing.Wins);
            writer.WriteNumber("losses", standing.Losses);
            writer.WriteNumber("undecided", standing.Undecided);
            writer.WriteNumber("longestWinStreak", standing.LongestWinStreak);
            writer.WriteNumber("pointsFor", standing.PointsFor);
            writer.WriteNumber("pointsAgainst", standing.PointsAgainst);
            writer.WriteEndObject();
        }

        writer.WriteEndArray();
    }
}
