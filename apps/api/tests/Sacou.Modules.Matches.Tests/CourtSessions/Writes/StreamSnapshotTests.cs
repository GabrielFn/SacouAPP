using System.Collections.Immutable;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.Appliers;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;
using Xunit;
using static Sacou.Modules.Matches.Tests.CourtSessions.Writes.CourtWriteFixture;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Writes;

/// <summary>The snapshot of the stored stream and the decision over it (ADR 0081), beyond the golden of every cut.</summary>
public sealed class StreamSnapshotTests
{
    /// <summary>Long, and still under the 1,500 events of one match.</summary>
    private const int LongStream = 1_400;
    private const int PointsPerSet = 25;

    private static readonly (string Type, string Payload) Start = (ScoreEventTypes.MatchStarted, MatchStarted(points: PointsPerSet));

    [Fact]
    public void With_LeavesTheSnapshotItCameFromAsItWas()
    {
        var events = Events(1, Start, (ScoreEventTypes.PointScored, Point("a")));
        var before = StreamSnapshot.Empty.Advance(Court, events[..1]);

        var after = before.With(events[1..], before.Head!.Push(events[1].Envelope, CourtSessionState.Initial));

        Assert.Equal((1, 2), (before.Version, after.Version));
        Assert.Null(before.Find(events[1].Envelope.EventId));
        Assert.Equal(0, StreamSnapshot.Empty.Version);
        Assert.Equal(events[0].Envelope.EventId, before.Head!.LastEvent!.EventId);
    }

    /// <summary>Undoing to the first event of a long stream is a walk back on the kept timeline, as the whole replay gives.</summary>
    [Fact]
    public void ARevertToTheFirstEventOfALongStream_IsTheWholeReplay()
    {
        var stored = LongStreamOfPoints();
        var stream = StoredStream.Of(StreamSnapshot.Empty.Advance(Court, stored), [new CourtWriter(1, Device, Caller, EventsBefore: 0)]);
        var revert = Events(LongStream + 1, (EventLogSchema.RevertedToEventType, Revert(1)));

        var decision = Accepted(Decide(stream, revert));
        var whole = EventReplayer.ReplayEvents(ScoreAppliers.Config(Court), stored.Concat(revert).Select(item => item.Envelope));

        Assert.NotNull(decision.Snapshot);
        Assert.Equal([EventId(1)], whole.Value.ActiveEventIds);
        Assert.Equal(EventId(1), decision.Snapshot.Head!.LastEvent!.EventId);
        Assert.Equal(CourtSessionStateWriter.ToJson(whole.Value.State), CourtSessionStateWriter.ToJson(decision.Snapshot.Head.StateOr(CourtSessionState.Initial)));
        Assert.Equal(LongStream + 1, decision.Snapshot.Version);
    }

    /// <summary>Stored events that do not replay keep no head, and every write is refused as before the snapshot, by the stored event.</summary>
    [Fact]
    public void StoredEventsThatDoNotReplay_SendTheWriteToTheWholeReplay()
    {
        var stored = Events(1, (ScoreEventTypes.PointScored, Point("a")));
        var snapshot = StreamSnapshot.Empty.Advance(Court, stored);

        var error = Refused(Decide(StoredStream.Of(snapshot, [new CourtWriter(1, Device, Caller, EventsBefore: 0)]), Events(2, (ScoreEventTypes.PointScored, Point("b")))));

        Assert.Null(snapshot.Head);
        Assert.Equal((CourtWriteErrorCode.EventRejected, EventId(1)), (error.Code, error.EventId));
        Assert.Null(StreamSnapshot.Empty.Advance(Court, stored).Advance(Court, Events(2, Start)).Head);
    }

    /// <summary>A new event that does not come after every stored one by order key, or names a stored id, is replayed with the whole stream.</summary>
    [Fact]
    public void NewEventsBeforeTheStoredOnes_AreReplayedWithTheWholeStream()
    {
        var stored = Events(1, Start, (ScoreEventTypes.PointScored, Point("a")), (ScoreEventTypes.PointScored, Point("b")));
        var snapshot = StreamSnapshot.Empty.Advance(Court, stored);
        var config = ScoreAppliers.Config(Court);
        ImmutableArray<EventEnvelope>[] breaking =
        [
            [Parse(Envelope(2, ScoreEventTypes.PointScored, Point("a"), device: OtherDevice, eventId: EventId(90))).Envelope],
            [Parse(Envelope(1, ScoreEventTypes.PointScored, Point("a"), device: OtherDevice, eventId: EventId(91))).Envelope],
            [stored[2].Envelope],
            [Parse(Envelope(3, ScoreEventTypes.PointScored, Point("a"), eventId: EventId(92))).Envelope],
        ];

        Assert.True(snapshot.Continues(Court, [Parse(Envelope(4, ScoreEventTypes.PointScored, Point("a"))).Envelope]));
        Assert.All(breaking, news =>
        {
            Assert.False(snapshot.Continues(Court, news));
            var whole = EventReplayer.ReplaySteps(config, stored.Select(item => item.Envelope).Concat(news), _ => true);
            var continued = EventReplayer.ContinueSteps(config, snapshot, news, _ => true);
            Assert.Equal(whole.IsSuccess, continued.IsSuccess);
            Assert.Equal(whole.IsSuccess ? null : whole.Error, continued.IsSuccess ? null : continued.Error);
        });
    }

    /// <summary>Stored events of another stream keep no head, and nothing continues them.</summary>
    [Fact]
    public void StoredEventsOfAnotherStream_KeepNoHead()
    {
        var stored = Events(1, Start, (ScoreEventTypes.PointScored, Point("a")));
        var foreign = StreamSnapshot.Empty.Advance("c0000000-0000-4000-8000-000000000999", stored);

        Assert.Null(foreign.Head);
        Assert.False(foreign.Continues(Court, [Parse(Envelope(3, ScoreEventTypes.PointScored, Point("b"))).Envelope]));
    }

    [Fact]
    public void TheSnapshot_KnowsTheLastSequenceOfEachDeviceAndItsLastEvent()
    {
        var stored = Events(1, Start, (ScoreEventTypes.PointScored, Point("a")), (ScoreEventTypes.PointScored, Point("b")));
        var snapshot = StreamSnapshot.Empty.Advance(Court, stored);

        Assert.Equal((3L, 0L), (snapshot.LastSequenceOf(Device), snapshot.LastSequenceOf(OtherDevice)));
        Assert.Equal(EventId(3), snapshot.LastStoredEventId);
        Assert.Equal(EventId(3), snapshot.LastEvent!.EventId);
        Assert.Equal(stored.Sum(item => item.ByteCount), snapshot.TotalBytes);
    }

    /// <summary>The refusal of a phone that does not write, and the takeover, from the writers, the count and one sequence.</summary>
    [Fact]
    public void AWrittenStream_AnswersLikeTheStoredOne()
    {
        var stored = Events(1, Start, (ScoreEventTypes.PointScored, Point("a")));
        ImmutableArray<CourtWriter> writers = [new CourtWriter(1, Device, Caller, 0), new CourtWriter(2, OtherDevice, OtherCaller, 2)];
        var full = StoredStream.Of(stored, writers);
        var light = new WrittenStream(CourtWriterHistory.Of(writers), eventCount: 2, Device, lastSequenceOfDevice: 2);
        var request = CourtWriteRequest.Create(Court, Events(3, (ScoreEventTypes.PointScored, Point("b"))), SupportedVersions.EventSchemaVersions).Value;

        Assert.Equal(
            CourtWriteRules.CheckWriter(full, request, Context).Error,
            CourtWriteRules.CheckWriter(light, request, Context).Error);
        Assert.Throws<ArgumentException>(() => light.LastSequenceOf(OtherDevice));
        var takeover = CourtTakeoverRequest.Create(Device, expectedBatch: 2, expectedEventCount: 2).Value;
        Assert.Equal(CourtTakeover.Decide(full, takeover, Caller).Value, CourtTakeover.Decide(light, takeover, Caller).Value);
    }

    /// <summary>A start of a set to 25 and points a, b, a, b...: the set is never decided.</summary>
    private static ImmutableArray<StreamEvent> LongStreamOfPoints() =>
        Events(1, [Start, .. Enumerable.Range(0, LongStream - 1).Select(index => (ScoreEventTypes.PointScored, Point(index % 2 == 0 ? "a" : "b")))]);
}
