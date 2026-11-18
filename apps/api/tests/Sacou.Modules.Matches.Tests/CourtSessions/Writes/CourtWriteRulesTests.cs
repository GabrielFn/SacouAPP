using System.Collections.Immutable;
using System.Text;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;
using Xunit;
using static Sacou.Modules.Matches.Tests.CourtSessions.Writes.CourtWriteFixture;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Writes;

/// <summary>The writer, resends, sequences and all or nothing of <see cref="CourtWriteRules"/> (ADR 0060, D2 to D4).</summary>
public sealed class CourtWriteRulesTests
{
    private static readonly ImmutableArray<StreamEvent> SixEvents = Events(
        1,
        (ScoreEventTypes.MatchStarted, MatchStarted(points: 25)),
        (ScoreEventTypes.PointScored, Point("a")),
        (ScoreEventTypes.PointScored, Point("a")),
        (ScoreEventTypes.PointScored, Point("b")),
        (ScoreEventTypes.PointScored, Point("b")),
        (ScoreEventTypes.PointScored, Point("a")));

    private static readonly ImmutableArray<StreamEvent> EightEvents =
        [.. SixEvents, .. Events(7, (ScoreEventTypes.PointScored, Point("a")), (ScoreEventTypes.PointScored, Point("b")))];

    [Fact]
    public void FirstWrite_CreatesTheStreamWithBatchOneAndTheCaller()
    {
        var decision = Accepted(Decide(StoredStream.New, SixEvents));

        Assert.True(decision.CreatesStream);
        Assert.Equal(new CourtWriter(1, Device, Caller, EventsBefore: 0), decision.Writer);
        Assert.Equal(6, decision.NewEvents.Length);
        Assert.Equal(6, decision.LastSequence);
        Assert.Equal(0, decision.Duplicates);
    }

    [Fact]
    public void FirstWrite_WithAnotherBatch_IsABatchMismatch()
    {
        var events = ImmutableArray.Create(Parse(Envelope(1, ScoreEventTypes.MatchStarted, MatchStarted(), batch: 2)));

        Assert.Equal(CourtWriteErrorCode.BatchMismatch, Refused(Decide(StoredStream.New, events)).Code);
    }

    [Fact]
    public void PureResend_StoresNothingAndKeepsTheLastSequence()
    {
        var decision = Accepted(Decide(Stored(SixEvents), SixEvents));

        Assert.Empty(decision.NewEvents);
        Assert.Equal(6, decision.LastSequence);
        Assert.Equal(6, decision.Duplicates);
        Assert.False(decision.CreatesStream);
    }

    [Fact]
    public void PartialResend_StoresOnlyTheNewEvents()
    {
        var decision = Accepted(Decide(Stored(SixEvents), EightEvents[4..]));

        Assert.Equal([EventId(7), EventId(8)], decision.NewEvents.Select(item => item.Envelope.EventId));
        Assert.Equal(8, decision.LastSequence);
        Assert.Equal(2, decision.Duplicates);
    }

    [Fact]
    public void Resend_WithThePayloadKeysInAnotherOrder_IsADuplicate()
    {
        var reordered = Parse(Envelope(2, ScoreEventTypes.PointScored, $$"""{"team":"a","setNumber":1,"matchId":"{{Match}}"}"""));

        Assert.Equal(1, Accepted(Decide(Stored(SixEvents), [reordered])).Duplicates);
    }

    [Fact]
    public void Resend_WithAnotherValue_IsAnEventIdConflict()
    {
        var changed = Parse(Envelope(2, ScoreEventTypes.PointScored, Point("b")));

        var error = Refused(Decide(Stored(SixEvents), [changed]));

        Assert.Equal(CourtWriteErrorCode.EventIdConflict, error.Code);
        Assert.Equal(EventId(2), error.EventId);
    }

    [Fact]
    public void FirstNewEvent_AheadOfTheDevice_IsAGapWithTheExpectedSequence()
    {
        var error = Refused(Decide(Stored(SixEvents), EightEvents[7..]));

        Assert.Equal(CourtWriteErrorCode.SequenceGap, error.Code);
        Assert.Equal(7, error.ExpectedSequence);
    }

    [Fact]
    public void NewEvent_WithAUsedSequence_IsASequenceConflict()
    {
        var clash = Parse(Envelope(6, ScoreEventTypes.PointScored, Point("b"), eventId: EventId(60)));

        var error = Refused(Decide(Stored(SixEvents), [clash]));

        Assert.Equal(CourtWriteErrorCode.SequenceConflict, error.Code);
        Assert.Equal(EventId(60), error.EventId);
    }

    [Theory]
    [InlineData(OtherDevice, Caller)]
    [InlineData(Device, OtherCaller)]
    public void AnotherDeviceOrMember_IsNotTheWriter(string device, string caller)
    {
        var events = ImmutableArray.Create(Parse(Envelope(7, ScoreEventTypes.PointScored, Point("a"), device: device)));

        var error = Refused(Decide(Stored(SixEvents), events, Context with { CallerMemberId = caller }));

        Assert.Equal(CourtWriteErrorCode.NotTheWriter, error.Code);
        Assert.Null(error.EventId);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(3)]
    public void TheWriter_InAnotherBatch_IsABatchMismatch(long batch)
    {
        var events = ImmutableArray.Create(Parse(Envelope(7, ScoreEventTypes.PointScored, Point("a"), batch: batch)));

        var error = Refused(Decide(Stored(SixEvents, new CourtWriter(2, Device, Caller, EventsBefore: 0)), events));

        Assert.Equal(CourtWriteErrorCode.BatchMismatch, error.Code);
    }

    /// <summary>Batch 0 never reaches the write rules: the envelope parser only takes a positive batch.</summary>
    [Fact]
    public void BatchZero_IsRefusedByTheEnvelopeParser()
    {
        var bytes = Encoding.UTF8.GetBytes(Envelope(7, ScoreEventTypes.PointScored, Point("a"), batch: 0));

        var envelope = EnvelopeParser.Parse(RawValueReader.Parse(bytes));

        Assert.True(envelope.IsFailure);
    }

    [Fact]
    public void ARefusal_StoresNoEventOfTheRequest()
    {
        var events = Events(
            7,
            (ScoreEventTypes.PointScored, Point("a")),
            (ScoreEventTypes.PointScored, Point("a")),
            (ScoreEventTypes.SetEnded, SetEnded(1, "a", NextSet("b", 25))));

        var error = Refused(Decide(Stored(SixEvents), events));

        Assert.Equal(CourtWriteErrorCode.EventImplausible, error.Code);
        Assert.Equal(EventId(9), error.EventId);
    }

    [Fact]
    public void AReplayRefusal_CarriesTheCodeOfTheReplay()
    {
        var events = ImmutableArray.Create(Parse(Envelope(7, "RevertedTo", Revert(99))));

        var error = Refused(Decide(Stored(SixEvents), events));

        Assert.Equal(CourtWriteErrorCode.EventRejected, error.Code);
        Assert.Equal("invalid-revert-target", error.Reason);
        Assert.Equal(EventId(7), error.EventId);
    }

    [Fact]
    public void MemberOutsideTheGroup_IsRefusedWithoutNamingIt()
    {
        var events = Events(7, (ScoreEventTypes.MatchEnded, MatchEnded("manual", "null")))
            .AddRange(Events(8, (ScoreEventTypes.MatchStarted, MatchStarted(teamB: Outsider).Replace(Match, "f0000000-0000-4000-8000-000000000002", StringComparison.Ordinal))));

        var error = Refused(Decide(Stored(SixEvents), events));

        Assert.Equal(CourtWriteErrorCode.MemberNotInGroup, error.Code);
        Assert.Equal(EventId(8), error.EventId);
        Assert.DoesNotContain(Outsider, error.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public void Decide_IsDeterministic()
    {
        var first = Accepted(Decide(Stored(SixEvents), EightEvents[4..]));
        var second = Accepted(Decide(Stored(SixEvents), EightEvents[4..]));

        Assert.Equal(first.NewEvents, second.NewEvents);
        Assert.Equal(first.LastSequence, second.LastSequence);
    }
}
