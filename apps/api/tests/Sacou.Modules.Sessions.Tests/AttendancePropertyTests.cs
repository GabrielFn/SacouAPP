using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Domain.Rounds;
using Xunit;
using static Sacou.Modules.Sessions.Tests.RoundFixture;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>A14: a thousand answers in a fixed random order never break the invariants of the line.</summary>
public sealed class AttendancePropertyTests
{
    private const int Answers = 1000;
    private const int People = 20;
    private const int Capacity = 6;
    private const int Seed = 20261110;

    [Fact]
    public void RandomAnswers_KeepSpotsBounded_LineOrdered_AndSequencesUnique()
    {
        var random = new Random(Seed);
        var rules = Rules(capacity: Capacity);
        var round = NewRound();
        var lastNext = round.NextSequence;

        for (var step = 0; step < Answers; step++)
        {
            var response = random.Next(2) == 0 ? AttendanceResponse.Going : AttendanceResponse.NotGoing;
            var actor = random.Next(4) == 0 ? ResponseActor.Admin : ResponseActor.Self;
            var result = Respond(round, rules, random.Next(1, People + 1), response, actor);
            round = result.IsSuccess ? result.Value.Round : round;

            Assert.InRange(round.SpotsHeld, 0, Capacity);
            Assert.True(round.NextSequence >= lastNext);
            lastNext = round.NextSequence;
            AssertLineIsSound(round);
        }
    }

    private static void AssertLineIsSound(Round round)
    {
        var sequences = round.Attendances.Select(a => a.Sequence).ToList();
        Assert.Equal(sequences.Count, sequences.Distinct().Count());
        Assert.True(round.Waitlist.Select(a => a.Sequence).SequenceEqual(round.Waitlist.Select(a => a.Sequence).Order()));
        Assert.True(round.Waitlist.IsEmpty || round.SpotsHeld == Capacity, "A free spot with someone waiting.");
        Assert.All(round.Attendances, a => Assert.Equal(a.Status == AttendanceStatus.Promoted, a.PromotedAt is not null));
    }
}
