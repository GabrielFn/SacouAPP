using System.Text.Json;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Queue;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Tests.CourtSessions.Score;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Queue;

/// <summary>The C# side of the unit tests of <c>queue.test.ts</c> for the modes: the win streak and the order of the refusals.</summary>
public sealed class NextMatchPlannerTests
{
    private const string RevertCase = "e10-revert-before-the-second-match-started-brings-back-the-queue-and-the-count";
    private const string ThreeWinsCase = "s1-three-wins-two-teams-waiting-both-leave";
    private const string OneSingleCase = "s4-four-wins-one-single-waiting-one-of-the-winner-leaves";

    /// <summary>Written by hand from <c>queue/constants.data.ts</c>: a limit changed on one side only fails here or in TypeScript.</summary>
    private const int MinFixedExitCount = 1;
    private const int MaxFixedExitCount = 24;
    private const int MinWinnerExitWins = 1;
    private const int MaxWinnerExitWins = 10;
    private const int DefaultFixedExitCount = 2;
    private const int DefaultWinnerExitWins = 3;

    private static readonly IReadOnlyList<JsonElement> QueueEvents = GoldenFile.ReadEmbeddedCases("queue-events.json");
    private static readonly IReadOnlyList<JsonElement> QueueModes = GoldenFile.ReadEmbeddedCases("queue-modes.json");

    [Theory]
    [InlineData(ThreeWinsCase, 3, 0)]
    [InlineData("s6-a-match-without-a-winner-resets-the-streak", 1, 0)]
    [InlineData("s7-a-new-member-in-the-winner-resets-the-streak", 1, 0)]
    [InlineData("s8-a-loss-resets-the-streak-of-the-new-winner", 0, 1)]
    public void WinStreak_CountsTheWinsInARowOfTheSameMembers(string id, int sideA, int sideB)
    {
        var state = StateOf(id);

        Assert.Equal(sideA, MatchHistory.GetWinStreak(state, TeamSide.A));
        Assert.Equal(sideB, MatchHistory.GetWinStreak(state, TeamSide.B));
    }

    [Fact]
    public void WinStreak_ARevertedToBeforeTheLastMatchEnded_TakesTheWinBack()
    {
        var goldenCase = GoldenFile.SingleCase(QueueEvents, GoldenFile.IdOf, RevertCase);
        var withoutRevert = ScoreEventsGolden.RunTimeline(goldenCase, envelope => envelope.Type != EventLogSchema.RevertedToEventType);

        Assert.Equal(2, MatchHistory.GetWinStreak(withoutRevert!.Value.Entries[^1].State, TeamSide.A));
        Assert.Equal(1, MatchHistory.GetWinStreak(ScoreEventsGolden.Run(goldenCase).State, TeamSide.A));
    }

    [Fact]
    public void WinStreak_WithoutAFinishedMatch_IsZero()
    {
        Assert.Equal(0, MatchHistory.GetWinStreak(CourtSessionState.Initial, TeamSide.A));
    }

    [Theory]
    [InlineData("""{ "playersPerTeam": 0, "exitMode": { "kind": "level" } }""", QueueRefusalCodes.InvalidPlayersPerTeam)]
    [InlineData("""{ "exitMode": { "kind": "level" }, "winnerExit": { "wins": 0 } }""", QueueRefusalCodes.InvalidExitMode)]
    [InlineData("""{ "winnerExit": { "wins": 0 }, "criterionInput": { "arrivalOrder": [] } }""", QueueRefusalCodes.InvalidWinnerExit)]
    [InlineData("""{ "exitMode": [], "winnerExit": 3 }""", QueueRefusalCodes.InvalidExitMode)]
    [InlineData("""{ "winnerExit": [] }""", QueueRefusalCodes.InvalidWinnerExit)]
    [InlineData("""{ "criterion": "constructor" }""", QueueRefusalCodes.InvalidExitChoice)]
    [InlineData("""{ "winnerCriterionInput": [] }""", QueueRefusalCodes.InvalidExitChoice)]
    public void Refusals_ComeInTheOrderOfTheAdr(string change, string code)
    {
        var planned = NextMatchPlanner.Plan(StateOf(OneSingleCase), Changed(OneSingleCase, change));

        Assert.True(planned.IsFailure);
        Assert.Equal(QueueCommandError.Refused(code), planned.Error);
    }

    [Fact]
    public void Limits_AreTheOnesOfTheTypeScriptEngine()
    {
        Assert.Equal(
            (MinFixedExitCount, MaxFixedExitCount, DefaultFixedExitCount),
            (QueueExitLimits.MinFixedExitCount, QueueExitLimits.MaxFixedExitCount, QueueExitLimits.DefaultFixedExitCount));
        Assert.Equal(
            (MinWinnerExitWins, MaxWinnerExitWins, DefaultWinnerExitWins),
            (QueueExitLimits.MinWinnerExitWins, QueueExitLimits.MaxWinnerExitWins, QueueExitLimits.DefaultWinnerExitWins));
        Assert.False(QueueExitLimits.DefaultWinnerExitEnabled);
        Assert.Equal(["automatic", "whole-team", "fixed-count"], QueueExitLimits.ExitModeKinds);
        Assert.Equal(["consecutive-matches", "arrival-order", "draw", "manual"], QueueExitLimits.CriterionKeys);
    }

    private static CourtSessionState StateOf(string id) =>
        CourtSessionStateReader.Read(GoldenFile.SingleCase(QueueModes, GoldenFile.IdOf, id).GetProperty("input").GetProperty("state"));

    /// <summary>The input of the case with some keys replaced, as the screen may send them.</summary>
    private static NextMatchInput Changed(string id, string change)
    {
        var input = NextMatchPlanGolden.Input(GoldenFile.SingleCase(QueueModes, GoldenFile.IdOf, id).GetProperty("input"));
        var changes = (RawObject)RawValueReader.Parse(change);
        RawValue Of(string key, RawValue current) => changes.TryGetMember(key, out var value) ? value : current;
        return new NextMatchInput(
            Of("criterion", input.Criterion),
            Of("criterionInput", input.CriterionInput),
            Of("playersPerTeam", input.PlayersPerTeam),
            Of("exitMode", input.ExitMode),
            Of("winnerExit", input.WinnerExit),
            Of("winnerCriterionInput", input.WinnerCriterionInput));
    }
}
