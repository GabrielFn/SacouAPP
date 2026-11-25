using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Domain.Rounds;
using Xunit;
using static Sacou.Modules.Sessions.Tests.RoundFixture;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>J1 to J8: mensalistas pre-confirmed, avulsos behind a window, the type read at the moment of the answer.</summary>
public sealed class RegularAndDropInTests
{
    private static readonly TimeSpan Day = TimeSpan.FromHours(24);

    [Fact]
    public void J1_ActiveRegulars_AreConfirmedInJoinOrder_WithTheirOwnPosition()
    {
        var change = Seed(Rules(), 3);

        Assert.All(Enumerable.Range(1, 3), n => Assert.Equal(AttendanceStatus.Going, StatusOf(change.Round, n)));
        Assert.All(change.Round.Attendances, a => Assert.Equal(AttendanceSource.Regular, a.Source));
        Assert.Equal([1, 2, 3], Enumerable.Range(1, 3).Select(n => change.Round.RegularPositionOf(Member(n))!.Value));
        Assert.Equal(3, change.Events.OfType<AttendanceChanged>().Count());
    }

    [Theory]
    [InlineData(false, true)]
    [InlineData(true, false)]
    public void J2_RegularsRuleOffOrAttendanceOff_NobodyIsPreConfirmed(bool regulars, bool enabled)
    {
        Assert.Empty(Seed(Rules(regulars: regulars, enabled: enabled), 3).Round.Attendances);
    }

    [Fact]
    public void J3_MoreRegularsThanSpots_TheRestWaitAheadOfAnyDropIn()
    {
        var rules = Rules(capacity: 12);
        var seeded = Seed(rules, 14).Round;

        Assert.Equal(12, seeded.SpotsHeld);
        Assert.Equal([Member(13), Member(14)], seeded.Waitlist.Select(a => a.Member));

        var withDropIn = Answer(seeded, rules, 99, AttendanceResponse.Going);
        Assert.Equal(3, withDropIn.PositionOf(Member(99)));
    }

    [Fact]
    public void J3_NoWaitlist_RegularsBeyondTheSpotsAreLeftOut()
    {
        var seeded = Seed(Rules(capacity: 2, waitlist: false), 4).Round;

        Assert.Equal(2, seeded.Attendances.Length);
    }

    [Fact]
    public void J4_RegularWhoDeclinedAndComesBack_GoesToTheEndOfTheLine()
    {
        var rules = Rules(capacity: 2);
        var round = Seed(rules, 2).Round;
        round = Answer(round, rules, 1, AttendanceResponse.NotGoing);
        round = Answer(round, rules, 3, AttendanceResponse.Going);
        round = Answer(round, rules, 4, AttendanceResponse.Going);

        round = Answer(round, rules, 1, AttendanceResponse.Going, kind: MemberKind.Regular);

        Assert.Equal(AttendanceStatus.Waitlisted, StatusOf(round, 1));
        Assert.Equal([Member(4), Member(1)], round.Waitlist.Select(a => a.Member));
    }

    [Fact]
    public void J5_Window_AdmitsDropInsFromTheExactInstant_AndNeverBlocksRegularsOrDeclines()
    {
        var rules = Rules(window: true, hours: 24);
        var round = NewRound();
        var opens = round.Slot.StartsAt - Day;

        Assert.Equal("sessions.drop-in-window-closed", Respond(round, rules, 1, AttendanceResponse.Going, now: opens.AddMinutes(-1)).Error.Code);
        Assert.True(Respond(round, rules, 1, AttendanceResponse.Going, now: opens).IsSuccess);
        Assert.True(Respond(round, rules, 1, AttendanceResponse.Going, now: opens.AddMinutes(1)).IsSuccess);
        Assert.True(Respond(round, rules, 2, AttendanceResponse.Going, kind: MemberKind.Regular, now: opens - Day).IsSuccess);
        Assert.True(Respond(round, rules, 3, AttendanceResponse.NotGoing, now: opens - Day).IsSuccess);
    }

    [Fact]
    public void J6_AdminAddsADropInOutsideTheWindow_ButStillWaitsWhenFull()
    {
        var rules = Rules(window: true, capacity: 1);
        var round = NewRound();
        var early = round.Slot.StartsAt - (3 * Day);

        round = Answer(round, rules, 1, AttendanceResponse.Going, ResponseActor.Admin, now: early);
        round = Answer(round, rules, 2, AttendanceResponse.Going, ResponseActor.Admin, now: early);

        Assert.Equal(AttendanceStatus.Going, StatusOf(round, 1));
        Assert.Equal(AttendanceStatus.Waitlisted, StatusOf(round, 2));
        Assert.Equal(AttendanceSource.Admin, round.AttendanceOf(Member(2))!.Source);
    }

    [Fact]
    public void J7_WindowOff_DropInAnswersAnyTimeBeforeTheStart()
    {
        var round = NewRound();

        Assert.True(Respond(round, Rules(window: false), 1, AttendanceResponse.Going, now: round.Slot.StartsAt - (30 * Day)).IsSuccess);
    }

    [Fact]
    public void J8_TheKindIsReadAtTheMoment_NotCopiedIntoTheAttendance()
    {
        var rules = Rules(window: true);
        var round = NewRound();
        var early = round.Slot.StartsAt - (3 * Day);

        var asRegular = Respond(round, rules, 5, AttendanceResponse.Going, kind: MemberKind.Regular, now: early);
        var asDropInAgain = Respond(round, rules, 5, AttendanceResponse.Going, kind: MemberKind.DropIn, now: early);

        Assert.True(asRegular.IsSuccess);
        Assert.Equal("sessions.drop-in-window-closed", asDropInAgain.Error.Code);
        Assert.Null(round.AttendanceOf(Member(5)));
    }

    [Fact]
    public void J9_NoActiveRegular_TheWindowDoesNotHold_AndTheDropInConfirmsAtOnce()
    {
        var round = NewRound();
        var early = round.Slot.StartsAt - (3 * Day);
        var withoutRegulars = Rules(window: true).ForGroup(hasActiveRegular: false);

        Assert.False(withoutRegulars.DropInWindowEnabled);
        Assert.Equal(AttendanceStatus.Going, StatusOf(Answer(round, withoutRegulars, 1, AttendanceResponse.Going, now: early), 1));
    }

    [Fact]
    public void J9_WithAnActiveRegular_TheWindowStillHolds_BeforeItOpensAndNotAfter()
    {
        var round = NewRound();
        var opens = round.Slot.StartsAt - Day;
        var withRegulars = Rules(window: true, hours: 24).ForGroup(hasActiveRegular: true);

        Assert.Equal(Rules(window: true, hours: 24), withRegulars);
        Assert.Equal("sessions.drop-in-window-closed", Respond(round, withRegulars, 1, AttendanceResponse.Going, now: opens.AddMinutes(-1)).Error.Code);
        Assert.True(Respond(round, withRegulars, 1, AttendanceResponse.Going, now: opens).IsSuccess);
    }

    [Fact]
    public void J9_NoActiveRegular_AfterTheWindowOpened_StillConfirms_AndAWindowOffStaysOff()
    {
        var round = NewRound();
        var opened = round.Slot.StartsAt - TimeSpan.FromHours(1);

        Assert.True(Respond(round, Rules(window: true).ForGroup(hasActiveRegular: false), 1, AttendanceResponse.Going, now: opened).IsSuccess);
        Assert.Equal(Rules(window: false), Rules(window: false).ForGroup(hasActiveRegular: false));
        Assert.Equal(Rules(window: false), Rules(window: false).ForGroup(hasActiveRegular: true));
    }

    private static RoundChange Seed(AttendanceSettings rules, int regulars) =>
        RoundReconciliation.SeedRegulars(NewRound(), rules, [.. Enumerable.Range(1, regulars).Select(Member)], Now);
}
