using System.Collections.Immutable;
using System.Diagnostics;
using System.Globalization;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.PlayerStatistics;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.Appliers;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.PlayerStatistics;

/// <summary>
/// The worst legal round of E3.9 part 1, condition 1: 200 finished matches of 24 against 24 with the
/// rotation on and a side-out every rally, about 19,600 events. The TypeScript summary took about 1.8 s
/// on the slow machine; the C# port shares the rallies and adds up in a local mutable map. The ceiling
/// is loose on purpose (Debug, a shared CI runner): it catches a return of the copy per rally, which
/// costs tens of seconds, not noise. The replay is measured apart and not asserted (ADR 0060, A10).
/// </summary>
public sealed class RoundSummaryWorstCaseTests
{
    private const int FinishedMatches = 200;
    private const int PointsPerMatch = 96;
    private const int TeamMembers = 24;
    private const int LineupMembers = 6;
    private const double SummaryCeilingSeconds = 5;
    private const string Court = "c0000000-0000-4000-8000-000000000001";
    private const string Device = "d0000000-0000-4000-8000-000000000001";

    [Fact]
    public void Summary_OfTheWorstRound_StaysUnderTheCeiling()
    {
        var log = Log();
        var replayStarted = Stopwatch.GetTimestamp();
        var timeline = EventReplayer.ReplayTimeline(ScoreAppliers.Config(Court), log);
        var replaySeconds = Stopwatch.GetElapsedTime(replayStarted).TotalSeconds;
        Assert.True(timeline.IsSuccess);

        var options = new RoundSummaryOptions(RoundModality.Indoor6x6, MvpEnabled: true, MvpByStats: true, IndividualPoints: true);
        var summaryStarted = Stopwatch.GetTimestamp();
        var summary = RoundSummaryRules.GetRoundSummary(timeline.Value, options);
        var summarySeconds = Stopwatch.GetElapsedTime(summaryStarted).TotalSeconds;

        TestContext.Current.TestOutputHelper?.WriteLine(
            $"{log.Length} events: replay {replaySeconds:F2} s, summary {summarySeconds:F2} s");
        Assert.Equal(FinishedMatches, summary.FinishedMatches.Length);
        Assert.Equal(TeamMembers * 2, summary.Players.Length);
        Assert.True(summarySeconds < SummaryCeilingSeconds, $"summary took {summarySeconds:F2} s");
    }

    private static ImmutableArray<EventEnvelope> Log()
    {
        ImmutableArray<string> payloads =
        [
            .. Enumerable.Range(1, FinishedMatches).SelectMany(number =>
                (IEnumerable<string>)
                [
                    MatchStarted(MatchIdOf(number)),
                    .. Enumerable.Range(0, PointsPerMatch).Select(index => Point(MatchIdOf(number), index % 2 == 0 ? "b" : "a")),
                    MatchEnded(MatchIdOf(number)),
                ]),
        ];
        return [.. payloads.Select((payload, index) => EnvelopeParser.Parse(RawValueReader.Parse(payload
            .Replace("@ID@", Number(index + 1), StringComparison.Ordinal)
            .Replace("@SEQ@", (index + 1).ToString(CultureInfo.InvariantCulture), StringComparison.Ordinal))).Value)];
    }

    private static string Number(int value) => value.ToString("D12", CultureInfo.InvariantCulture);

    private static string Envelope(string type, string payload) =>
        $$"""{"eventId":"e0000000-0000-4000-8000-@ID@","courtSessionId":"{{Court}}","deviceId":"{{Device}}","batch":1,"sequence":@SEQ@,"schemaVersion":1,"type":"{{type}}","payload":{{payload}}}""";

    private static string Members(char team, IEnumerable<int> numbers) =>
        "[" + string.Join(",", numbers.Select(number => $"\"{team}0000000-0000-4000-8000-{Number(number)}\"")) + "]";

    private static string MatchIdOf(int number) => $"f0000000-0000-4000-8000-{Number(number)}";

    private static string MatchStarted(string matchId)
    {
        string Rotation(char team) =>
            $$"""{"bench":{{Members(team, Enumerable.Range(LineupMembers + 1, TeamMembers - LineupMembers))}},"libero":null,"lineup":{{Members(team, Enumerable.Range(1, LineupMembers))}},"setterZone":1,"system":"5x1"}""";
        string Roster(char team) => "{\"memberIds\":" + Members(team, Enumerable.Range(1, TeamMembers)) + "}";
        var payload = "{\"matchId\":\"" + matchId + "\",\"rulesVersion\":1,\"formationsVersion\":1,"
            + "\"scoring\":{\"bestOf\":1,\"pointsPerSet\":99,\"tieBreakPoints\":null,\"winMargin\":2},"
            + "\"teams\":{\"a\":" + Roster('a') + ",\"b\":" + Roster('b') + "},\"firstServer\":\"a\","
            + "\"rotations\":{\"a\":" + Rotation('a') + ",\"b\":" + Rotation('b') + "},"
            + "\"queue\":{\"players\":[],\"teams\":[]}}";
        return Envelope(ScoreEventTypes.MatchStarted, payload);
    }

    private static string Point(string matchId, string team) =>
        Envelope(ScoreEventTypes.PointScored, $$"""{"matchId":"{{matchId}}","setNumber":1,"team":"{{team}}"}""");

    private static string MatchEnded(string matchId) =>
        Envelope(ScoreEventTypes.MatchEnded, $$"""{"matchId":"{{matchId}}","endReason":"manual","winner":"a"}""");
}
