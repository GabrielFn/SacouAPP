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
        var queue = new List<Sacou.Shared.Members.MemberId>();

        for (var step = 0; step < Answers; step++)
        {
            var response = random.Next(2) == 0 ? AttendanceResponse.Going : AttendanceResponse.NotGoing;
            var actor = random.Next(4) == 0 ? ResponseActor.Admin : ResponseActor.Self;
            var result = Respond(round, rules, random.Next(1, People + 1), response, actor);
            round = result.IsSuccess ? result.Value.Round : round;

            Assert.InRange(round.SpotsHeld, 0, Capacity);
            // The counter rises by exactly the number of new order numbers handed out in this step.
            var spent = round.Attendances.Count(a => a.Sequence >= lastNext);
            Assert.Equal(lastNext + spent, round.NextSequence);
            lastNext = round.NextSequence;
            AssertLineIsSound(round);
            queue = AssertWaitlistFollowsArrival(round, queue);
        }
    }

    private static void AssertLineIsSound(Round round)
    {
        var sequences = round.Attendances.Select(a => a.Sequence).ToList();
        Assert.Equal(sequences.Count, sequences.Distinct().Count());
        Assert.True(round.Waitlist.IsEmpty || round.SpotsHeld == Capacity, "A free spot with someone waiting.");
        Assert.All(round.Attendances, a => Assert.Equal(a.Status == AttendanceStatus.Promoted, a.PromotedAt is not null));
    }

    /// <summary>
    /// An oracle kept apart from <c>Round.Waitlist</c>: whoever starts waiting joins the end of this list and whoever
    /// stops waiting leaves it, so the line must equal it exactly.
    /// </summary>
    private static List<Sacou.Shared.Members.MemberId> AssertWaitlistFollowsArrival(Round round, List<Sacou.Shared.Members.MemberId> queue)
    {
        var waiting = round.Attendances.Where(a => a.IsWaiting).Select(a => a.Member).ToHashSet();
        var next = queue.Where(waiting.Contains).ToList();
        next.AddRange(round.Attendances.Where(a => a.IsWaiting && !next.Contains(a.Member)).OrderBy(a => a.Sequence).Select(a => a.Member));
        Assert.Equal(next, round.Waitlist.Select(a => a.Member));
        return next;
    }
}
