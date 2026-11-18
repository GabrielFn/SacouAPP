using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;
using Xunit;
using static Sacou.Modules.Matches.Tests.CourtSessions.Writes.CourtWriteFixture;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Writes;

/// <summary>The short scoreboard each write returns (ADR 0063, D6), case S1 of the plan.</summary>
public sealed class CourtScoreboardTests
{
    private const string Pt = ScoreEventTypes.PointScored;
    private const string Ended = ScoreEventTypes.SetEnded;

    /// <summary>A best of 3 to 3 points: a wins set 1 by 3 to 0 and leads set 2 by 1 to 2.</summary>
    private static readonly ImmutableArray<StreamEvent> MidSecondSet = Events(
        1,
        (ScoreEventTypes.MatchStarted, MatchStarted()),
        (Pt, Point("a")),
        (Pt, Point("a")),
        (Pt, Point("a")),
        (Ended, SetEnded(1, "a", NextSet("b", 3))),
        (Pt, Point("a", set: 2)),
        (Pt, Point("b", set: 2)),
        (Pt, Point("b", set: 2)));

    private static CourtScoreboard? ScoreboardOf(ImmutableArray<StreamEvent> events) =>
        Accepted(Decide(StoredStream.New, events)).Scoreboard;

    [Fact]
    public void MidSet_ShowsTheSetInPlayAndTheSetsWon()
    {
        Assert.Equal(new CourtScoreboard(Match, SetNumber: 2, PointsA: 1, PointsB: 2, SetsA: 1, SetsB: 0), ScoreboardOf(MidSecondSet));
    }

    [Fact]
    public void RightAfterASet_ShowsTheNextSetAtZero()
    {
        Assert.Equal(new CourtScoreboard(Match, 2, 0, 0, 1, 0), ScoreboardOf(MidSecondSet[..5]));
    }

    [Fact]
    public void BetweenTheLastSetAndTheEndOfTheMatch_ShowsTheLastSetPlayed()
    {
        var pending = Events(
            1,
            (ScoreEventTypes.MatchStarted, MatchStarted()),
            (Pt, Point("a")),
            (Pt, Point("a")),
            (Pt, Point("a")),
            (Ended, SetEnded(1, "a", NextSet("b", 3))),
            (Pt, Point("a", set: 2)),
            (Pt, Point("a", set: 2)),
            (Pt, Point("a", set: 2)),
            (Ended, SetEnded(2, "a", "null")));

        Assert.Equal(new CourtScoreboard(Match, 2, 3, 0, 2, 0), ScoreboardOf(pending));
    }

    [Fact]
    public void AfterTheMatchEnded_IsNull()
    {
        var ended = MidSecondSet.Add(Parse(Envelope(9, ScoreEventTypes.MatchEnded, MatchEnded("manual", "null"))));

        Assert.Null(ScoreboardOf(ended));
    }

    [Fact]
    public void WithNoMatch_IsNull()
    {
        Assert.Null(CourtScoreboard.From(CourtSessionState.Initial));
    }

    [Fact]
    public void APureResend_StoresNothingAndCarriesNoScoreboard()
    {
        Assert.Null(Accepted(Decide(Stored(MidSecondSet), MidSecondSet[^2..])).Scoreboard);
    }

    /// <summary>The new writer undoes, in batch 2, the last two points the old phone stored in batch 1.</summary>
    [Fact]
    public void AfterARevertToBeforeTheTakeover_ShowsTheRevertedState()
    {
        var stored = StoredStream.Of(MidSecondSet, [new CourtWriter(1, Device, Caller, 0), new CourtWriter(2, OtherDevice, OtherCaller, 8)]);
        var revert = ImmutableArray.Create(Parse(Envelope(1, "RevertedTo", Revert(6), device: OtherDevice, batch: 2, eventId: EventId(9))));

        var decision = Accepted(Decide(stored, revert, Context with { CallerMemberId = OtherCaller }));

        Assert.Equal(new CourtScoreboard(Match, 2, 1, 0, 1, 0), decision.Scoreboard);
    }

    [Fact]
    public void ToString_IsOnlyTheTypeName()
    {
        Assert.Equal(nameof(CourtScoreboard), ScoreboardOf(MidSecondSet)!.ToString());
    }
}
