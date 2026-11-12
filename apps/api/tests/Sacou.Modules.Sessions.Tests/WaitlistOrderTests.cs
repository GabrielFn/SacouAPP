using Sacou.Modules.Sessions.Domain.Attendances;
using Xunit;
using static Sacou.Modules.Sessions.Tests.RoundFixture;
using Reply = Sacou.Modules.Sessions.Domain.Attendances.AttendanceResponse;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>The line is ordered by <c>Sequence</c> (ADR 0043), never by the clock: two API instances can disagree by milliseconds.</summary>
public sealed class WaitlistOrderTests
{
    [Fact]
    public void Waitlist_FollowsSequence_EvenWhenTheClockOfTheLaterArrivalIsEarlier()
    {
        var rules = Rules(capacity: 1);
        var round = Answer(NewRound(), rules, 1, Reply.Going, now: Now);

        round = Answer(round, rules, 2, Reply.Going, now: Now.AddMinutes(5));
        round = Answer(round, rules, 3, Reply.Going, now: Now.AddMinutes(1));

        Assert.Equal([Member(2), Member(3)], round.Waitlist.Select(waiting => waiting.Member));
        var change = Respond(round, rules, 1, Reply.NotGoing, now: Now.AddMinutes(6)).Value;
        Assert.Equal(AttendanceStatus.Promoted, change.Round.AttendanceOf(Member(2))?.Status);
        Assert.Equal(AttendanceStatus.Waitlisted, change.Round.AttendanceOf(Member(3))?.Status);
    }
}
