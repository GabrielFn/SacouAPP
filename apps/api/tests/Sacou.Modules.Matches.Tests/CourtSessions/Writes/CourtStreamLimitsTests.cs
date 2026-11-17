using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;
using Xunit;
using static Sacou.Modules.Matches.Tests.CourtSessions.Writes.CourtWriteFixture;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Writes;

/// <summary>Each ceiling of D9 accepted at its value and refused one above, at the first event over it (ADR 0060).</summary>
public sealed class CourtStreamLimitsTests
{
    private const string Pt = ScoreEventTypes.PointScored;

    private static readonly (string Type, string Payload) Start = (ScoreEventTypes.MatchStarted, MatchStarted(points: 25));

    private static string MatchIdOf(int number) => $"f0000000-0000-4000-8000-{number:D12}";

    /// <summary>A match of exactly <paramref name="events"/> events: it starts, alternates points forever at deuce, and ends by hand.</summary>
    private static IEnumerable<(string Type, string Payload)> MatchOf(int number, int events)
    {
        string InMatch(string payload) => payload.Replace(Match, MatchIdOf(number), StringComparison.Ordinal);
        yield return (Start.Type, InMatch(Start.Payload));
        for (var point = 0; point < events - 2; point++)
        {
            yield return (Pt, InMatch(Point(point % 2 == 0 ? "b" : "a")));
        }

        yield return (ScoreEventTypes.MatchEnded, InMatch(MatchEnded("manual", "null")));
    }

    private static CourtWriteError? ErrorOf(StoredStream stored, ImmutableArray<StreamEvent> events)
    {
        var result = Decide(stored, events);
        return result.IsSuccess ? null : result.Error;
    }

    /// <summary>The log stored but its last event, which comes in its own request, as the app sends at each point.</summary>
    private static CourtWriteError? ErrorOfLast(ImmutableArray<StreamEvent> events) =>
        ErrorOf(events.Length == 1 ? StoredStream.New : Stored(events[..^1]), [events[^1]]);

    private static void AssertLimit(string limit, long eventSequence, CourtWriteError? error)
    {
        Assert.NotNull(error);
        Assert.Equal(CourtWriteErrorCode.LimitReached, error.Code);
        Assert.Equal(limit, error.Limit);
        Assert.Equal(EventId(eventSequence), error.EventId);
    }

    [Fact]
    public void EventsOfAMatch()
    {
        var match = Events(1, [.. MatchOf(1, CourtStreamLimits.MaxMatchEvents + 1)]);

        Assert.Null(ErrorOfLast(match[..CourtStreamLimits.MaxMatchEvents]));
        AssertLimit(StreamLimitNames.MatchEvents, CourtStreamLimits.MaxMatchEvents + 1, ErrorOfLast(match));
    }

    [Fact]
    public void EventsOfAStream_CountTheStoredOnes()
    {
        var full = Enumerable.Range(1, (CourtStreamLimits.MaxStreamEvents / CourtStreamLimits.MaxMatchEvents) + 1)
            .SelectMany(number => MatchOf(number, CourtStreamLimits.MaxMatchEvents))
            .Take(CourtStreamLimits.MaxStreamEvents + 1)
            .ToArray();
        var events = Events(1, full);
        var stored = Stored(events[..(CourtStreamLimits.MaxStreamEvents - 1)]);

        Assert.Null(ErrorOf(stored, events[(CourtStreamLimits.MaxStreamEvents - 1)..CourtStreamLimits.MaxStreamEvents]));
        AssertLimit(StreamLimitNames.StreamEvents, CourtStreamLimits.MaxStreamEvents + 1, ErrorOf(stored, events[(CourtStreamLimits.MaxStreamEvents - 1)..]));
    }

    [Fact]
    public void BytesOfAStream_CountTheStoredOnes()
    {
        var events = Events(1, Start, (Pt, Point("a")));
        var newBytes = events[1].ByteCount;
        StoredStream StoredWith(long bytes) => Stored([events[0] with { ByteCount = bytes }]);

        Assert.Null(ErrorOf(StoredWith(CourtStreamLimits.MaxStreamBytes - newBytes), events[1..]));
        AssertLimit(StreamLimitNames.StreamBytes, 2, ErrorOf(StoredWith(CourtStreamLimits.MaxStreamBytes - newBytes + 1), events[1..]));
    }

    [Fact]
    public void ServingChangesOfAMatch()
    {
        var changes = Enumerable.Range(0, CourtStreamLimits.MaxMatchServingChanges + 1)
            .Select(index => index % 2 == 0 ? "b" : "a")
            .Select(team => (ScoreEventTypes.ServingTeamChanged, ServingChanged(team, team)));
        var events = Events(1, [Start, .. changes]);

        Assert.Null(ErrorOfLast(events[..^1]));
        AssertLimit(StreamLimitNames.MatchServingChanges, events.Length, ErrorOfLast(events));
    }

    [Fact]
    public void RevertsOfAMatch_CountByTheMatchOfTheTarget()
    {
        var reverts = Enumerable.Repeat((EventLogSchema.RevertedToEventType, Revert(2)), CourtStreamLimits.MaxMatchReverts + 1);
        var events = Events(1, [Start, (Pt, Point("a")), .. reverts]);

        Assert.Null(ErrorOfLast(events[..^1]));
        AssertLimit(StreamLimitNames.MatchReverts, events.Length, ErrorOfLast(events));
    }

    [Fact]
    public void QueueChangesOfAStream()
    {
        var changes = Enumerable.Range(0, CourtStreamLimits.MaxStreamQueueChanges + 1)
            .Select(index => (ScoreEventTypes.QueueChanged, QueueOf(index % 2 == 0 ? Quoted(Caller) : string.Empty)));
        var events = Events(1, [Start, .. changes]);

        Assert.Null(ErrorOfLast(events[..^1]));
        AssertLimit(StreamLimitNames.StreamQueueChanges, events.Length, ErrorOfLast(events));
    }

    [Fact]
    public void LimitsOfARequest_FitTheBody()
    {
        Assert.True((long)CourtStreamLimits.MaxEventsPerRequest * CourtStreamLimits.MaxEnvelopeBytes > CourtStreamLimits.MaxRequestBytes);
        Assert.True(CourtStreamLimits.MaxEnvelopeBytes < CourtStreamLimits.MaxRequestBytes);
        Assert.True((long)CourtStreamLimits.MaxStreamQueueChanges * CourtStreamLimits.MaxEnvelopeBytes < CourtStreamLimits.MaxStreamBytes);
    }
}
