using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Domain.Rounds;
using Xunit;
using static Sacou.Modules.Sessions.Tests.RoundFixture;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>
/// A2: the whole transition table of ADR 0043, D1, written by hand: every origin, both answers, a free and
/// a full round, the waitlist on and off. The member under test is number 1; "none" means no row.
/// </summary>
public sealed class AttendanceTransitionTableTests
{
    public static readonly TheoryData<string, string, bool, bool, string> Table = new()
    {
        // origin, answer, round full, waitlist on, expected final status (or the refusal code)
        { "None", "Going", false, true, "Going" },
        { "None", "Going", false, false, "Going" },
        { "None", "Going", true, true, "Waitlisted" },
        { "None", "Going", true, false, "sessions.round-full" },
        { "NotGoing", "Going", false, true, "Going" },
        { "NotGoing", "Going", true, true, "Waitlisted" },
        { "NotGoing", "Going", true, false, "sessions.round-full" },
        { "Going", "Going", true, true, "Going" },
        { "Going", "Going", true, false, "Going" },
        { "Promoted", "Going", true, true, "Promoted" },
        { "Waitlisted", "Going", true, true, "Waitlisted" },
        { "None", "NotGoing", false, true, "NotGoing" },
        { "None", "NotGoing", true, true, "NotGoing" },
        { "NotGoing", "NotGoing", true, true, "NotGoing" },
        { "Going", "NotGoing", true, true, "NotGoing" },
        { "Going", "NotGoing", true, false, "NotGoing" },
        { "Promoted", "NotGoing", true, true, "NotGoing" },
        { "Waitlisted", "NotGoing", true, true, "NotGoing" },
    };

    [Theory]
    [MemberData(nameof(Table))]
    public void Respond_MatchesTheTable(string origin, string answer, bool full, bool waitlistOn, string expected)
    {
        var rules = Rules(capacity: 2, waitlist: waitlistOn);
        var round = Origin(origin, full);

        var result = Respond(round, rules, 1, Enum.Parse<AttendanceResponse>(answer));

        if (expected.StartsWith("sessions.", StringComparison.Ordinal))
        {
            Assert.Equal(expected, result.Error.Code);
            return;
        }

        Assert.Equal(Enum.Parse<AttendanceStatus>(expected), StatusOf(result.Value.Round, 1));
        // A new order number is spent only when the member's row is new or comes back: never for "no change" or a plain decline.
        var spends = (origin is "None" or "NotGoing" && answer == "Going") || (origin == "None" && answer == "NotGoing");
        Assert.Equal(round.NextSequence + (spends ? 1 : 0), result.Value.Round.NextSequence);
    }

    [Fact]
    public void SequenceChangesOnlyWhenTheStatusDoes()
    {
        var rules = Rules(capacity: 2);
        var round = Going(NewRound(), rules, 3);
        var waiting = round.AttendanceOf(Member(3))!;

        var same = Answer(round, rules, 3, AttendanceResponse.Going).AttendanceOf(Member(3))!;
        var back = Answer(Answer(round, rules, 3, AttendanceResponse.NotGoing), rules, 3, AttendanceResponse.Going).AttendanceOf(Member(3))!;

        Assert.Equal(waiting.Sequence, same.Sequence);
        Assert.True(back.Sequence > waiting.Sequence);
    }

    /// <summary>Capacity is 2. Where the table says "full" and the member holds no spot, members 2 and 3 hold both.</summary>
    private static Round Origin(string origin, bool full)
    {
        var others = full ? Fill(NewRound(), 2, 3) : NewRound();
        return origin switch
        {
            "None" => others,
            "NotGoing" => Say(Say(others, 1, AttendanceResponse.Going), 1, AttendanceResponse.NotGoing),
            "Going" => Fill(NewRound(), 1, 2),
            "Waitlisted" => Say(others, 1, AttendanceResponse.Going),
            "Promoted" => Say(Say(others, 1, AttendanceResponse.Going), 2, AttendanceResponse.NotGoing),
            _ => throw new ArgumentOutOfRangeException(nameof(origin), origin, "Not an origin of the table."),
        };
    }

    private static Round Fill(Round round, params int[] members) =>
        members.Aggregate(round, (current, member) => Say(current, member, AttendanceResponse.Going));

    private static Round Say(Round round, int member, AttendanceResponse response) =>
        Answer(round, Rules(capacity: 2), member, response);
}
