using System.Text.Json;
using Sacou.Modules.Matches.Domain.CourtSessions.Queue;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Score;

/// <summary>
/// Reads the <c>initialState</c> of a golden case as it is, without validating the partition
/// (ADR 0027): test only, because production derives the state from the events.
/// </summary>
internal static class CourtSessionStateReader
{
    private const string Context = "initialState";

    public static CourtSessionState Read(JsonElement state) =>
        new(
            Nullable(state.GetProperty("currentMatch"), Match),
            [.. state.GetProperty("finishedMatches").EnumerateArray().Select(Finished)],
            Queue(state.GetProperty("queue")));

    private static MatchScore Match(JsonElement match) =>
        new(
            [.. match.GetProperty("completedSets").EnumerateArray().Select(set => new CompletedMatchSet(
                Pair(set.GetProperty("score")),
                Integer(set.GetProperty("setNumber")),
                CourtSessionGoldenReader.Side(set.GetProperty("winner"))))],
            Nullable(match.GetProperty("currentSet"), CurrentSet),
            (long)Number(match.GetProperty("formationsVersion")),
            match.GetProperty("matchId").GetString()!,
            new BySide<TeamState?>(
                Nullable(match.GetProperty("rotations").GetProperty("a"), TeamStateOf),
                Nullable(match.GetProperty("rotations").GetProperty("b"), TeamStateOf)),
            (long)Number(match.GetProperty("rulesVersion")),
            Scoring(match.GetProperty("scoring")),
            Pair(match.GetProperty("setsWon")),
            new BySide<TeamRoster>(Roster(match.GetProperty("teams").GetProperty("a")), Roster(match.GetProperty("teams").GetProperty("b"))));

    private static FinishedMatch Finished(JsonElement finished)
    {
        var winner = finished.GetProperty("winner");
        return new FinishedMatch(
            Match(finished),
            MatchEndReason.All.Single(reason => reason.Code == finished.GetProperty("endReason").GetString()),
            winner.ValueKind == JsonValueKind.Null ? null : CourtSessionGoldenReader.Side(winner));
    }

    private static MatchSet CurrentSet(JsonElement set) =>
        new(
            CourtSessionGoldenReader.Side(set.GetProperty("firstServer")),
            Pair(set.GetProperty("score")),
            CourtSessionGoldenReader.Side(set.GetProperty("servingTeam")),
            Integer(set.GetProperty("setNumber")),
            Integer(set.GetProperty("targetPoints")));

    private static TeamState TeamStateOf(JsonElement teamState) =>
        new(
            CourtSessionGoldenReader.Texts(teamState.GetProperty("bench")),
            Nullable(teamState.GetProperty("libero"), libero => CourtSessionGoldenReader.Libero(libero, Context)),
            CourtSessionGoldenReader.Texts(teamState.GetProperty("lineup")),
            Integer(teamState.GetProperty("setterZone")),
            CourtSessionGoldenReader.System(teamState.GetProperty("system")));

    private static ScoringRules Scoring(JsonElement scoring)
    {
        var tieBreakPoints = scoring.GetProperty("tieBreakPoints");
        return new ScoringRules(
            Integer(scoring.GetProperty("bestOf")),
            Integer(scoring.GetProperty("pointsPerSet")),
            tieBreakPoints.ValueKind == JsonValueKind.Null ? null : Integer(tieBreakPoints),
            Integer(scoring.GetProperty("winMargin")));
    }

    private static TeamQueue Queue(JsonElement queue) =>
        new(CourtSessionGoldenReader.Texts(queue.GetProperty("players")), [.. queue.GetProperty("teams").EnumerateArray().Select(Roster)]);

    private static TeamRoster Roster(JsonElement roster) => new(CourtSessionGoldenReader.Texts(roster.GetProperty("memberIds")));

    private static BySide<int> Pair(JsonElement pair) => CourtSessionGoldenReader.Pair(pair, Context);

    private static int Integer(JsonElement value) => CourtSessionGoldenReader.Integer(value, Context);

    private static double Number(JsonElement value) => Sacou.Tests.Golden.GoldenFile.Number(value, Context);

    private static T? Nullable<T>(JsonElement value, Func<JsonElement, T> read)
        where T : class =>
        value.ValueKind == JsonValueKind.Null ? null : read(value);
}
