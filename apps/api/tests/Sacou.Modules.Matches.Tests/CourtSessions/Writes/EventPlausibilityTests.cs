using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;
using Xunit;
using static Sacou.Modules.Matches.Tests.CourtSessions.Writes.CourtWriteFixture;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Writes;

/// <summary>The checks of class a of <see cref="EventPlausibility"/>, through the write rules (ADR 0060, D10).</summary>
public sealed class EventPlausibilityTests
{
    private const string Pt = ScoreEventTypes.PointScored;
    private const string Ended = ScoreEventTypes.SetEnded;

    /// <summary>A best of 3 to 3 points with advantage and a tie-break to 2, nobody on a rotation.</summary>
    private static readonly (string Type, string Payload) Start = (ScoreEventTypes.MatchStarted, MatchStarted(tieBreak: "2"));

    private static readonly (string Type, string Payload)[] SetOneToA =
        [Start, (Pt, Point("a")), (Pt, Point("a")), (Pt, Point("a"))];

    private static string? ReasonOf(params (string Type, string Payload)[] events) => ReasonIn(Context, events);

    private static string? ReasonWithRotation(params (string Type, string Payload)[] events) => ReasonIn(RotationContext, events);

    private static string? ReasonIn(CourtWriteContext context, (string Type, string Payload)[] events)
    {
        var result = Decide(StoredStream.New, Events(1, events), context);
        if (result.IsSuccess)
        {
            return null;
        }

        Assert.Equal(CourtWriteErrorCode.EventImplausible, result.Error.Code);
        Assert.Equal(EventId(events.Length), result.Error.EventId);
        return result.Error.Reason;
    }

    [Fact]
    public void PointScored_InADecidedSet_IsImplausible()
    {
        Assert.Equal(ImplausibleReasons.SetDecided, ReasonOf([.. SetOneToA, (Pt, Point("a"))]));
    }

    [Fact]
    public void PointScored_AtDeuce_IsPlausible()
    {
        Assert.Null(ReasonOf(Start, (Pt, Point("a")), (Pt, Point("b")), (Pt, Point("a")), (Pt, Point("b")), (Pt, Point("a"))));
    }

    [Theory]
    [InlineData("b", ImplausibleReasons.WrongSetWinner)]
    [InlineData("a", null)]
    public void SetEnded_NamesTheWinnerOfTheScore(string winner, string? reason)
    {
        Assert.Equal(reason, ReasonOf([.. SetOneToA, (Ended, SetEnded(1, winner, NextSet("b", 3)))]));
    }

    [Fact]
    public void SetEnded_BeforeTheSetIsDecided_IsImplausible()
    {
        Assert.Equal(ImplausibleReasons.SetNotDecided, ReasonOf(Start, (Pt, Point("a")), (Ended, SetEnded(1, "a", NextSet("b", 3)))));
    }

    [Fact]
    public void SetEnded_WithoutANextSet_ThatDoesNotDecideTheMatch_IsImplausible()
    {
        Assert.Equal(ImplausibleReasons.WrongNextSet, ReasonOf([.. SetOneToA, (Ended, SetEnded(1, "a", "null"))]));
    }

    [Fact]
    public void SetEnded_WithANextSet_ThatDecidesTheMatch_IsImplausible()
    {
        Assert.Equal(ImplausibleReasons.WrongNextSet, ReasonOf(
        [
            .. SetOneToA,
            (Ended, SetEnded(1, "a", NextSet("b", 3))),
            (Pt, Point("a", 2)), (Pt, Point("a", 2)), (Pt, Point("a", 2)),
            (Ended, SetEnded(2, "a", NextSet("a", 2))),
        ]));
    }

    [Theory]
    [InlineData(2, ImplausibleReasons.WrongTargetPoints)]
    [InlineData(3, null)]
    public void SetEnded_OpensTheNextSetWithItsTarget(int targetPoints, string? reason)
    {
        Assert.Equal(reason, ReasonOf([.. SetOneToA, (Ended, SetEnded(1, "a", NextSet("b", targetPoints)))]));
    }

    [Fact]
    public void SetEnded_OutsideTheDecidingSet_AlternatesTheFirstServer()
    {
        Assert.Equal(ImplausibleReasons.WrongFirstServer, ReasonOf([.. SetOneToA, (Ended, SetEnded(1, "a", NextSet("a", 3)))]));
    }

    [Theory]
    [InlineData("a")]
    [InlineData("b")]
    public void SetEnded_BeforeTheDecidingSet_TakesAnyToss(string firstServer)
    {
        Assert.Null(ReasonOf(
        [
            .. SetOneToA,
            (Ended, SetEnded(1, "a", NextSet("b", 3))),
            (Pt, Point("b", 2)), (Pt, Point("b", 2)), (Pt, Point("b", 2)),
            (Ended, SetEnded(2, "b", NextSet(firstServer, 2))),
        ]));
    }

    [Fact]
    public void TwoSetEndedAtZero_AndAMatchWon_AreRefusedAtTheFirst()
    {
        var result = Decide(StoredStream.New, Events(
            1,
            Start,
            (Ended, SetEnded(1, "a", NextSet("b", 3))),
            (Ended, SetEnded(2, "a", "null")),
            (ScoreEventTypes.MatchEnded, MatchEnded("sets-won", Quoted("a")))));

        Assert.Equal(EventId(2), Refused(result).EventId);
        Assert.Equal(ImplausibleReasons.SetNotDecided, result.Error.Reason);
    }

    [Theory]
    [InlineData("sets-won", "\"b\"", ImplausibleReasons.WrongMatchWinner)]
    [InlineData("sets-won", "\"a\"", null)]
    [InlineData("manual", "\"b\"", null)]
    public void MatchEnded_ByTheSets_NamesTheWinner(string reason, string winner, string? expected)
    {
        Assert.Equal(expected, ReasonOf(
            (ScoreEventTypes.MatchStarted, MatchStarted(bestOf: 1)), (Pt, Point("a")), (Pt, Point("a")), (Pt, Point("a")),
            (Ended, SetEnded(1, "a", "null")),
            (ScoreEventTypes.MatchEnded, MatchEnded(reason, winner))));
    }

    [Fact]
    public void MatchEnded_ByHand_WithASetOpen_IsPlausible()
    {
        Assert.Null(ReasonOf(Start, (Pt, Point("b")), (ScoreEventTypes.MatchEnded, MatchEnded("manual", "null"))));
    }

    /// <summary>A point or a serve change there is already refused by the replay, which needs an open set.</summary>
    [Fact]
    public void AQueueChangeBetweenTheDecidingSetEndedAndTheMatchEnded_IsImplausible()
    {
        Assert.Equal(ImplausibleReasons.MatchPending, ReasonOf(
            (ScoreEventTypes.MatchStarted, MatchStarted(bestOf: 1)), (Pt, Point("a")), (Pt, Point("a")), (Pt, Point("a")),
            (Ended, SetEnded(1, "a", "null")),
            (ScoreEventTypes.QueueChanged, QueueOf(Quoted(Caller)))));
    }

    [Fact]
    public void UndoAndAttribution_WhileTheMatchIsPending_ArePlausible()
    {
        Assert.Null(ReasonOf(
            (ScoreEventTypes.MatchStarted, MatchStarted(bestOf: 1)), (Pt, Point("a")), (Pt, Point("a")), (Pt, Point("a")),
            (Ended, SetEnded(1, "a", "null")),
            (ScoreEventTypes.PointAttributed, Attributed(4, "attack", Quoted(MemberA))),
            (EventLogSchema.RevertedToEventType, Revert(4))));
    }

    [Theory]
    [InlineData("a", "a", ImplausibleReasons.WrongServingTeam)]
    [InlineData("b", "a", ImplausibleReasons.WrongFirstServer)]
    [InlineData("b", "b", null)]
    public void ServingTeamChanged_AtZero_AlsoChangesTheFirstServer(string servingTeam, string firstServer, string? reason)
    {
        Assert.Equal(reason, ReasonOf(Start, (ScoreEventTypes.ServingTeamChanged, ServingChanged(servingTeam, firstServer))));
    }

    /// <summary>b scored on the serve of a, so b serves and a served first.</summary>
    [Theory]
    [InlineData("b", ImplausibleReasons.WrongFirstServer)]
    [InlineData("a", null)]
    public void ServingTeamChanged_AfterPoints_KeepsTheFirstServer(string firstServer, string? reason)
    {
        Assert.Equal(reason, ReasonOf(Start, (Pt, Point("b")), (ScoreEventTypes.ServingTeamChanged, ServingChanged("a", firstServer))));
    }

    [Fact]
    public void ServingTeamChanged_InADecidedSet_IsImplausible()
    {
        Assert.Equal(ImplausibleReasons.SetDecided, ReasonOf([.. SetOneToA, (ScoreEventTypes.ServingTeamChanged, ServingChanged("b", "a"))]));
    }

    [Theory]
    [InlineData(99, "attack", MemberA, ImplausibleReasons.InvalidAttributionTarget)]
    [InlineData(1, "attack", MemberA, ImplausibleReasons.InvalidAttributionTarget)]
    [InlineData(2, "ace", MemberB, ImplausibleReasons.InvalidPointAuthor)]
    [InlineData(2, "attack", MemberB, null)]
    public void PointAttributed_IsOfAPointOfTheMatch_ByAPlausibleAuthor(long target, string kind, string author, string? reason)
    {
        Assert.Equal(reason, ReasonOf(Start, (Pt, Point("b")), (ScoreEventTypes.PointAttributed, Attributed(target, kind, Quoted(author)))));
    }

    /// <summary>The libero is on court in slot 2 and may attack, but never blocks nor serves (ADR 0031, P1).</summary>
    [Theory]
    [InlineData("block", ImplausibleReasons.InvalidPointAuthor)]
    [InlineData("attack", null)]
    public void PointAttributed_ToTheLibero_IsNeverABlock(string kind, string? reason)
    {
        Assert.Equal(reason, ReasonWithRotation(
            (ScoreEventTypes.MatchStarted, MatchStartedWithRotation(withLibero: true)),
            (Pt, Point("a")),
            (ScoreEventTypes.PointAttributed, Attributed(2, kind, Quoted(TeamMember('a', 7))))));
    }

    /// <summary>a7 came in after the point, so it was not on court in the rally; a1, now on the bench, was.</summary>
    [Theory]
    [InlineData(7, ImplausibleReasons.InvalidPointAuthor)]
    [InlineData(1, null)]
    public void PointAttributed_IsOfWhoWasOnCourtInTheRally(int author, string? reason)
    {
        Assert.Equal(reason, ReasonWithRotation(
            (ScoreEventTypes.MatchStarted, MatchStartedWithRotation(withLibero: false)),
            (Pt, Point("a")),
            (ScoreEventTypes.LineupChanged, LineupChangedOfA(7)),
            (ScoreEventTypes.PointAttributed, Attributed(2, "attack", Quoted(TeamMember('a', author))))));
    }

    [Fact]
    public void PointAttributed_ToAPointOfAnotherMatch_IsImplausible()
    {
        const string NextMatch = "f0000000-0000-4000-8000-000000000002";
        string InNextMatch(string payload) => payload.Replace(Match, NextMatch, StringComparison.Ordinal);

        Assert.Equal(ImplausibleReasons.InvalidAttributionTarget, ReasonOf(
            Start, (Pt, Point("a")),
            (ScoreEventTypes.MatchEnded, MatchEnded("manual", "null")),
            (ScoreEventTypes.MatchStarted, InNextMatch(Start.Payload)),
            (ScoreEventTypes.PointAttributed, InNextMatch(Attributed(2, "attack", Quoted(MemberA))))));
    }

    [Fact]
    public void PointAttributed_ToASetEnded_IsImplausible()
    {
        Assert.Equal(ImplausibleReasons.InvalidAttributionTarget, ReasonOf(
        [
            .. SetOneToA,
            (Ended, SetEnded(1, "a", NextSet("b", 3))),
            (ScoreEventTypes.PointAttributed, Attributed(5, "attack", Quoted(MemberA))),
        ]));
    }

    /// <summary>The payload parser already refuses an author on an error of the opponent, so the replay does.</summary>
    [Fact]
    public void PointAttributed_OfAnOpponentErrorWithAnAuthor_IsRejectedByTheReplay()
    {
        var result = Decide(StoredStream.New, Events(1, Start, (Pt, Point("b")), (ScoreEventTypes.PointAttributed, Attributed(2, "opponent-error", Quoted(MemberB)))));

        Assert.Equal(CourtWriteErrorCode.EventRejected, Refused(result).Code);
    }

    [Fact]
    public void PointAttributed_ToAnUndonePoint_IsImplausible()
    {
        Assert.Equal(ImplausibleReasons.InvalidAttributionTarget, ReasonOf(
            Start, (Pt, Point("a")), (Pt, Point("a")),
            (EventLogSchema.RevertedToEventType, Revert(2)),
            (ScoreEventTypes.PointAttributed, Attributed(3, "attack", Quoted(MemberA)))));
    }

    [Fact]
    public void PointAttributed_ThreeTimes_IsAccepted_AndTheFourthReachesTheLimit()
    {
        (string, string)[] three =
        [
            Start, (Pt, Point("a")),
            (ScoreEventTypes.PointAttributed, Attributed(2, "attack", Quoted(MemberA))),
            (ScoreEventTypes.PointAttributed, Attributed(2, "ace", Quoted(MemberA))),
            (ScoreEventTypes.PointAttributed, Attributed(2, "other", Quoted(MemberA))),
        ];
        Assert.Null(ReasonOf(three));

        var error = Refused(Decide(StoredStream.New, Events(1, [.. three, (ScoreEventTypes.PointAttributed, Attributed(2, "block", Quoted(MemberA)))])));

        Assert.Equal(CourtWriteErrorCode.LimitReached, error.Code);
        Assert.Equal(StreamLimitNames.PointAttributions, error.Limit);
        Assert.Equal(EventId(6), error.EventId);
    }

    [Theory]
    [InlineData("", ImplausibleReasons.QueueUnchanged)]
    [InlineData("\"" + Caller + "\"", null)]
    public void QueueChanged_ChangesTheQueue(string players, string? reason)
    {
        Assert.Equal(reason, ReasonOf(Start, (ScoreEventTypes.QueueChanged, QueueOf(players))));
    }

    [Theory]
    [InlineData(999, ImplausibleReasons.UnsupportedRulesVersion)]
    [InlineData(1, null)]
    public void MatchStarted_HasASupportedRulesVersion(long rulesVersion, string? reason)
    {
        Assert.Equal(reason, ReasonOf((ScoreEventTypes.MatchStarted, MatchStarted(rulesVersion: rulesVersion))));
    }

    [Fact]
    public void MatchStarted_HasASupportedFormationsVersion()
    {
        var payload = MatchStarted().Replace("\"formationsVersion\":1", "\"formationsVersion\":2", StringComparison.Ordinal);

        Assert.Equal(ImplausibleReasons.UnsupportedFormationsVersion, ReasonOf((ScoreEventTypes.MatchStarted, payload)));
    }

    [Fact]
    public void Reasons_AreAClosedListOfDistinctCodes()
    {
        Assert.Equal(ImplausibleReasons.All.Length, ImplausibleReasons.All.Distinct(StringComparer.Ordinal).Count());
        Assert.Equal(CourtWriteErrorCode.All.Length, CourtWriteErrorCode.All.Select(code => code.Code).Distinct(StringComparer.Ordinal).Count());
        Assert.Equal(StreamLimitNames.All.Length, StreamLimitNames.All.Distinct(StringComparer.Ordinal).Count());
        Assert.All(ImplausibleReasons.All, reason => Assert.Matches("^[a-z-]+$", reason));
    }
}
