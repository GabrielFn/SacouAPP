using System.Text.Json;
using Sacou.Modules.Matches.Domain.CourtSessions.PlayerStatistics;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Tests.CourtSessions.EventLog;
using Sacou.Modules.Matches.Tests.CourtSessions.Score;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.PlayerStatistics;

/// <summary>Port of <c>stats-events.golden.test.ts</c>, reading the same file. Key order is part of the contract.</summary>
public sealed class StatsEventsGoldenTests
{
    private const int GoldenCaseCount = 9;

    private static readonly string[] GoldenIds =
    [
        "s1-the-round-of-the-plan",
        "s2-the-libero-counts-only-on-the-court",
        "s3-rotation-off-counts-the-whole-team-in-order",
        "s4-the-bench-wins-with-a-zero-balance",
        "s5-no-winner-is-undecided-and-breaks-the-streak",
        "s6-manual-end-with-a-winner-counts-the-points-after-the-last-set",
        "s7-the-open-match-counts-nothing",
        "s8-reverted-lineup-and-point-count-nothing",
        "s9-empty-round",
    ];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("stats-events.json");

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

    [Fact]
    public void CreditedPointKinds_AreThePointKindsWithAnAuthor_InOrder()
    {
        Assert.Equal(PointKind.All.Except(PointKind.Authorless), PointsByKind.CreditedPointKinds);
    }

    [Theory]
    [MemberData(nameof(CaseIds))]
    public void Stats_MatchTheGoldenCase(string id)
    {
        var goldenCase = GoldenFile.SingleCase(Cases, GoldenFile.IdOf, id);
        var timeline = ScoreEventsGolden.RunTimeline(goldenCase);
        Assert.NotNull(timeline);

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
                writer.WriteStartArray("playerStats");
                foreach (var stats in StatisticsRules.GetPlayerStats(timeline.Value))
                {
                    WritePlayer(writer, stats);
                }

                writer.WriteEndArray();
                var sides = StatisticsRules.GetSideStats(timeline.Value);
                writer.WriteStartObject("sideStats");
                WriteSide(writer, "a", sides.A);
                WriteSide(writer, "b", sides.B);
                writer.WriteEndObject();
            }

            writer.WriteEndObject();
        }, id);
    }

    internal static void WritePlayer(Utf8JsonWriter writer, PlayerStats stats)
    {
        writer.WriteStartObject();
        writer.WriteString("memberId", stats.MemberId);
        writer.WriteNumber("matchesPlayed", stats.MatchesPlayed);
        writer.WriteNumber("wins", stats.Wins);
        writer.WriteNumber("losses", stats.Losses);
        writer.WriteNumber("undecided", stats.Undecided);
        writer.WriteNumber("pointsFor", stats.PointsFor);
        writer.WriteNumber("pointsAgainst", stats.PointsAgainst);
        writer.WriteNumber("plusMinus", stats.PlusMinus);
        writer.WriteNumber("longestWinStreak", stats.LongestWinStreak);
        writer.WriteNumber("currentWinStreak", stats.CurrentWinStreak);
        CourtSessionGoldenReader.WriteTexts(writer, "results", stats.Results.Select(result => result.Code));
        writer.WriteStartObject("pointsByKind");
        writer.WriteNumber("attack", stats.PointsByKind.Attack);
        writer.WriteNumber("block", stats.PointsByKind.Block);
        writer.WriteNumber("ace", stats.PointsByKind.Ace);
        writer.WriteNumber("other", stats.PointsByKind.Other);
        writer.WriteEndObject();
        writer.WriteEndObject();
    }

    private static void WriteSide(Utf8JsonWriter writer, string key, SideStats stats)
    {
        writer.WriteStartObject(key);
        writer.WriteNumber("wins", stats.Wins);
        writer.WriteNumber("longestWinStreak", stats.LongestWinStreak);
        writer.WriteNumber("currentWinStreak", stats.CurrentWinStreak);
        writer.WriteEndObject();
    }
}
