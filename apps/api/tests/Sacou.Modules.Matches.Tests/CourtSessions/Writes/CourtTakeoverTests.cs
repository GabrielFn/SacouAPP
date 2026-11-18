using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;
using Xunit;
using static Sacou.Modules.Matches.Tests.CourtSessions.Writes.CourtWriteFixture;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Writes;

/// <summary>The takeover of ADR 0063 (D1 to D3, D8 and D10), cases T1 to T7 of the plan.</summary>
public sealed class CourtTakeoverTests
{
    private const string Pt = ScoreEventTypes.PointScored;
    private const string ThirdDevice = "d0000000-0000-4000-8000-000000000003";

    private static readonly ImmutableArray<StreamEvent> SixEvents = Events(
        1,
        (ScoreEventTypes.MatchStarted, MatchStarted(points: 25)),
        (Pt, Point("a")),
        (Pt, Point("b")),
        (Pt, Point("a")),
        (Pt, Point("a")),
        (Pt, Point("b")));

    private static readonly CourtWriter FirstWriter = new(1, Device, Caller, EventsBefore: 0);

    /// <summary>Batches 1 and 2 by the first writer and the other, then batch 3 by the first writer again.</summary>
    private static readonly ImmutableArray<CourtWriter> ThreeBatches =
    [
        FirstWriter,
        new(2, OtherDevice, OtherCaller, EventsBefore: 2),
        new(3, ThirdDevice, Caller, EventsBefore: 4),
    ];

    private static CourtTakeoverRequest Request(string device, long expectedBatch, long expectedEventCount)
    {
        var request = CourtTakeoverRequest.Create(device, expectedBatch, expectedEventCount);
        Assert.True(request.IsSuccess, request.ToString());
        return request.Value;
    }

    private static Result<CourtTakeoverDecision, CourtWriteError> TakeOver(
        StoredStream stored, string device, string caller, long expectedBatch, long expectedEventCount) =>
        CourtTakeover.Decide(stored, Request(device, expectedBatch, expectedEventCount), caller);

    private static CourtTakeoverDecision Taken(Result<CourtTakeoverDecision, CourtWriteError> result)
    {
        Assert.True(result.IsSuccess, result.ToString());
        return result.Value;
    }

    private static CourtWriteError Refused(Result<CourtTakeoverDecision, CourtWriteError> result)
    {
        Assert.True(result.IsFailure, "Expected a refusal.");
        return result.Error;
    }

    private static StoredStream WithWriters(ImmutableArray<StreamEvent> events, params CourtWriter[] writers) =>
        StoredStream.Of(events, [.. writers]);

    [Fact]
    public void T1_TakeoverWithTheExpectedStream_OpensTheNextBatchAfterTheStoredEvents()
    {
        var stored = WithWriters(SixEvents, [.. ThreeBatches]);

        var decision = Taken(TakeOver(stored, OtherDevice, OtherCaller, expectedBatch: 3, expectedEventCount: 6));

        Assert.True(decision.OpensBatch);
        Assert.Equal(new CourtWriter(4, OtherDevice, OtherCaller, EventsBefore: 6), decision.Writer);
    }

    [Fact]
    public void T1_LastSequence_IsTheOneOfTheDeviceInTheStream_OrZero()
    {
        var stored = Stored(SixEvents);

        Assert.Equal(0, Taken(TakeOver(stored, OtherDevice, OtherCaller, 1, 6)).LastSequence);
        Assert.Equal(6, Taken(TakeOver(stored, Device, OtherCaller, 1, 6)).LastSequence);
    }

    [Theory]
    [InlineData(1, 5)]
    [InlineData(1, 7)]
    [InlineData(2, 6)]
    [InlineData(0, 6)]
    [InlineData(1, 0)]
    public void T2_AStreamThatMovedSinceTheConfirmation_IsStreamChanged(long expectedBatch, long expectedEventCount)
    {
        var error = Refused(TakeOver(Stored(SixEvents), OtherDevice, OtherCaller, expectedBatch, expectedEventCount));

        Assert.Equal(CourtWriteErrorCode.StreamChanged, error.Code);
        Assert.Null(error.CurrentBatch);
    }

    [Theory]
    [InlineData(1, 6)]
    [InlineData(1, 2)]
    [InlineData(0, 0)]
    public void T3_ThePairAlreadyWriting_GetsItsBatchAgain_WhateverItExpected(long expectedBatch, long expectedEventCount)
    {
        var decision = Taken(TakeOver(Stored(SixEvents), Device, Caller, expectedBatch, expectedEventCount));

        Assert.False(decision.OpensBatch);
        Assert.Equal(FirstWriter, decision.Writer);
        Assert.Equal(6, decision.LastSequence);
    }

    [Theory]
    [InlineData(Device, OtherCaller)]
    [InlineData(OtherDevice, Caller)]
    public void T4_TheSamePhoneWithAnotherLogin_OrTheSameMemberOnAnotherPhone_IsANewTakeover(string device, string caller)
    {
        var decision = Taken(TakeOver(Stored(SixEvents), device, caller, 1, 6));

        Assert.True(decision.OpensBatch);
        Assert.Equal(new CourtWriter(2, device, caller, EventsBefore: 6), decision.Writer);
    }

    [Fact]
    public void T5_TheFortiethBatchOpens_TheFortyFirstIsTheLimit()
    {
        var at39 = WithWriters(SixEvents, FirstWriter, new CourtWriter(39, Device, Caller, EventsBefore: 6));
        var at40 = WithWriters(SixEvents, FirstWriter, new CourtWriter(CourtStreamLimits.MaxWritersPerStream, Device, Caller, EventsBefore: 6));

        Assert.Equal(CourtStreamLimits.MaxWritersPerStream, Taken(TakeOver(at39, OtherDevice, OtherCaller, 39, 6)).Writer.Batch);
        var error = Refused(TakeOver(at40, OtherDevice, OtherCaller, CourtStreamLimits.MaxWritersPerStream, 6));
        Assert.Equal(CourtWriteErrorCode.LimitReached, error.Code);
        Assert.Equal(StreamLimitNames.WritersPerStream, error.Limit);
    }

    [Fact]
    public void T5_AtTheLimit_ThePairAlreadyWritingIsStillAccepted()
    {
        var at40 = WithWriters(SixEvents, FirstWriter, new CourtWriter(CourtStreamLimits.MaxWritersPerStream, Device, Caller, EventsBefore: 6));

        Assert.False(Taken(TakeOver(at40, Device, Caller, CourtStreamLimits.MaxWritersPerStream, 6)).OpensBatch);
    }

    [Fact]
    public void T6_TheOldPhone_WithItsNextSequenceInTheOldBatch_IsNotTheWriterWithTheBatchAndItsLastSequence()
    {
        var stored = AfterTakeover();

        var error = CourtWriteFixture.Refused(CourtWriteFixture.Decide(stored, Events(7, (Pt, Point("a")))));

        Assert.Equal(CourtWriteErrorCode.NotTheWriter, error.Code);
        Assert.Equal(2, error.CurrentBatch);
        Assert.Equal(6, error.LastSequence);
    }

    [Fact]
    public void T6_TheOldPhone_WithTheNewBatchForged_IsStillNotTheWriter()
    {
        var forged = ImmutableArray.Create(Parse(Envelope(7, Pt, Point("a"), batch: 2)));

        var error = CourtWriteFixture.Refused(CourtWriteFixture.Decide(AfterTakeover(), forged));

        Assert.Equal(CourtWriteErrorCode.NotTheWriter, error.Code);
        Assert.Equal(6, error.LastSequence);
    }

    /// <summary>The same phone with another login has a sequence in the stream, but that pair never wrote a batch.</summary>
    [Theory]
    [InlineData(ThirdDevice, Caller)]
    [InlineData(Device, MemberA)]
    [InlineData(OtherDevice, Caller)]
    public void T6_APairThatNeverWroteABatch_IsNotTheWriterWithoutALastSequence(string device, string caller)
    {
        var events = ImmutableArray.Create(Parse(Envelope(7, Pt, Point("a"), device: device, batch: 2)));

        var error = CourtWriteFixture.Refused(CourtWriteFixture.Decide(AfterTakeover(), events, Context with { CallerMemberId = caller }));

        Assert.Equal(CourtWriteErrorCode.NotTheWriter, error.Code);
        Assert.Equal(2, error.CurrentBatch);
        Assert.Null(error.LastSequence);
    }

    [Fact]
    public void T6_TheNewWriter_WritesInItsBatch()
    {
        var events = ImmutableArray.Create(Parse(Envelope(1, Pt, Point("b"), device: OtherDevice, batch: 2)));

        var decision = Accepted(CourtWriteFixture.Decide(AfterTakeover(), events, Context with { CallerMemberId = OtherCaller }));

        Assert.Equal(1, decision.LastSequence);
        Assert.False(decision.CreatesStream);
    }

    /// <summary>The envelopes carry no device clock; the refusal is by the batch the server recorded, whatever the phone believes.</summary>
    [Fact]
    public void T7_EventsTheOldPhoneMarkedBeforeTheTakeover_AreRefusedTheSameWay()
    {
        var late = Events(7, (Pt, Point("a")), (Pt, Point("b")), (Pt, Point("a")));

        var error = CourtWriteFixture.Refused(CourtWriteFixture.Decide(AfterTakeover(), late));

        Assert.Equal(CourtWriteErrorCode.NotTheWriter, error.Code);
    }

    [Theory]
    [InlineData("D0000000-0000-4000-8000-000000000002", 1, 6, CourtTakeoverRequest.DeviceIdField)]
    [InlineData("not-a-uuid", 1, 6, CourtTakeoverRequest.DeviceIdField)]
    [InlineData("", 1, 6, CourtTakeoverRequest.DeviceIdField)]
    [InlineData(OtherDevice, -1, 6, CourtTakeoverRequest.ExpectedBatchField)]
    [InlineData(OtherDevice, 1, -1, CourtTakeoverRequest.ExpectedEventCountField)]
    [InlineData("x", -1, -1, CourtTakeoverRequest.DeviceIdField)]
    public void Request_WithAnInvalidField_IsTakeoverInvalidNamingTheFirstField(string device, long batch, long count, string field)
    {
        var request = CourtTakeoverRequest.Create(device, batch, count);

        Assert.True(request.IsFailure);
        Assert.Equal(CourtWriteErrorCode.TakeoverInvalid, request.Error.Code);
        Assert.Equal(field, request.Error.Field);
    }

    [Fact]
    public void Takeover_OfAStreamThatDoesNotExist_IsAProgrammingError()
    {
        Assert.Throws<ArgumentException>(() => TakeOver(StoredStream.New, OtherDevice, OtherCaller, 0, 0));
    }

    [Fact]
    public void StoredStream_KeepsTheWritersByBatch_AndKnowsWhenTheCurrentBatchBegan()
    {
        var stored = WithWriters(SixEvents, ThreeBatches[2], ThreeBatches[0], ThreeBatches[1]);

        Assert.Equal([1L, 2L, 3L], stored.Writers.Select(writer => writer.Batch));
        Assert.Equal(ThreeBatches[2], stored.Writer);
        Assert.Equal(4, stored.EventsBeforeCurrentBatch);
        Assert.Equal(0, StoredStream.New.EventsBeforeCurrentBatch);
        Assert.Throws<ArgumentException>(() => StoredStream.Of(SixEvents, []));
    }

    [Fact]
    public void PreviousWriterOf_FindsOnlyAnEarlierBatchOfTheSamePair()
    {
        var stored = WithWriters(SixEvents, [.. ThreeBatches]);

        Assert.Equal(ThreeBatches[0], stored.PreviousWriterOf(Device, Caller));
        Assert.Equal(ThreeBatches[1], stored.PreviousWriterOf(OtherDevice, OtherCaller));
        Assert.Null(stored.PreviousWriterOf(ThirdDevice, Caller));
        Assert.Null(stored.PreviousWriterOf(Device, OtherCaller));
        Assert.Null(stored.PreviousWriterOf(OtherDevice, Caller));
    }

    [Fact]
    public void Decide_IsDeterministic()
    {
        var stored = Stored(SixEvents);

        Assert.Equal(Taken(TakeOver(stored, OtherDevice, OtherCaller, 1, 6)), Taken(TakeOver(stored, OtherDevice, OtherCaller, 1, 6)));
    }

    [Fact]
    public void NewTypes_NeverPrintADeviceOrAMember()
    {
        var decision = Taken(TakeOver(Stored(SixEvents), OtherDevice, OtherCaller, 1, 6));
        var texts = new[]
        {
            decision.ToString(),
            decision.Writer.ToString(),
            Request(OtherDevice, 1, 6).ToString(),
            Stored(SixEvents).ToString(),
        };

        Assert.All(texts, text => Assert.DoesNotContain(OtherDevice, text, StringComparison.Ordinal));
        Assert.All(texts, text => Assert.DoesNotContain(OtherCaller, text, StringComparison.Ordinal));
    }

    /// <summary>The six events of the first writer, then batch 2 taken by the other device and member.</summary>
    private static StoredStream AfterTakeover() =>
        WithWriters(SixEvents, FirstWriter, new CourtWriter(2, OtherDevice, OtherCaller, EventsBefore: 6));
}
