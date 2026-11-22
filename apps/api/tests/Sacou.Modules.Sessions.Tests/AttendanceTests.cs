using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Domain.Rounds;
using Xunit;
using static Sacou.Modules.Sessions.Tests.RoundFixture;
using Reply = Sacou.Modules.Sessions.Domain.Attendances.AttendanceResponse;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>A1 and A3 to A9 of the E3.4 plan: the reducer of attendance, one rule at a time.</summary>
public sealed class AttendanceTests
{
    [Fact]
    public void A1_TwelfthTakesTheLastSpot_ThirteenthWaitsFirstInLine()
    {
        var rules = Rules(capacity: 12);
        var round = Going(NewRound(), rules, 11);

        round = Answer(round, rules, 12, Reply.Going);
        round = Answer(round, rules, 13, Reply.Going);

        Assert.Equal(AttendanceStatus.Going, StatusOf(round, 12));
        Assert.Equal(AttendanceStatus.Waitlisted, StatusOf(round, 13));
        Assert.Equal(1, round.PositionOf(Member(13)));
        Assert.Equal(12, round.SpotsHeld);
    }

    [Fact]
    public void A3_GoingTwice_ChangesNothing_AndKeepsTheSequence()
    {
        var rules = Rules();
        var round = Going(NewRound(), rules, 1);
        var before = round.AttendanceOf(Member(1))!;

        var again = Respond(round, rules, 1, Reply.Going).Value;

        Assert.True(again.IsEmpty);
        Assert.Equal(before, again.Round.AttendanceOf(Member(1)));
        Assert.Equal(round.NextSequence, again.Round.NextSequence);
    }

    [Fact]
    public void A3_NotGoingTwice_ChangesNothing()
    {
        var rules = Rules();
        var round = Answer(Going(NewRound(), rules, 1), rules, 1, Reply.NotGoing);

        Assert.True(Respond(round, rules, 1, Reply.NotGoing).Value.IsEmpty);
    }

    [Fact]
    public void A4_GoingGivesUp_FirstInLineIsPromoted_WithOnlyIds()
    {
        var rules = Rules(capacity: 2);
        var round = Going(NewRound(), rules, 4);

        var change = Respond(round, rules, 1, Reply.NotGoing).Value;

        Assert.Equal(AttendanceStatus.Promoted, StatusOf(change.Round, 3));
        Assert.Equal(Now, change.Round.AttendanceOf(Member(3))!.PromotedAt);
        Assert.Equal(1, change.Round.PositionOf(Member(4)));
        Assert.Contains(change.Events, e => e is WaitlistPromoted promoted && promoted.MemberId == Member(3) && promoted.RoundId == round.Id);
        Assert.Contains(change.Events, e => e is AttendanceChanged { Status: AttendanceStatus.NotGoing } changed && changed.MemberId == Member(1));
    }

    [Fact]
    public void U1_WaitlistPromoted_CarriesTheSequenceOfThePromotedAttendance()
    {
        var rules = Rules(capacity: 2);
        var round = Going(NewRound(), rules, 4);

        var change = Respond(round, rules, 1, Reply.NotGoing).Value;

        var promoted = Assert.Single(change.Events.OfType<WaitlistPromoted>());
        Assert.Equal(change.Round.AttendanceOf(Member(3))!.Sequence, promoted.Sequence);
        Assert.Equal(round.AttendanceOf(Member(3))!.Sequence, promoted.Sequence);
    }

    [Fact]
    public void A5_PromotedGivesUp_NextIsPromoted_AndPromotedHoldsASpot()
    {
        var rules = Rules(capacity: 1);
        var round = Going(NewRound(), rules, 3);
        round = Answer(round, rules, 1, Reply.NotGoing);
        Assert.Equal(AttendanceStatus.Promoted, StatusOf(round, 2));
        Assert.Equal(1, round.SpotsHeld);

        round = Answer(round, rules, 2, Reply.NotGoing);

        Assert.Equal(AttendanceStatus.Promoted, StatusOf(round, 3));
        Assert.Equal(1, round.SpotsHeld);
    }

    [Fact]
    public void A6_LeavingTheLine_RecalculatesPositions_AndPromotesNobody()
    {
        var rules = Rules(capacity: 1);
        var round = Going(NewRound(), rules, 4);

        round = Answer(round, rules, 2, Reply.NotGoing);

        Assert.Equal(AttendanceStatus.Going, StatusOf(round, 1));
        Assert.Equal(1, round.PositionOf(Member(3)));
        Assert.Equal(2, round.PositionOf(Member(4)));
        Assert.Null(round.PositionOf(Member(2)));
    }

    [Fact]
    public void A7_FullWithoutWaitlist_IsRoundFull_AndWithWaitlist_Waits()
    {
        var full = Going(NewRound(), Rules(capacity: 2, waitlist: false), 2);

        var refused = Respond(full, Rules(capacity: 2, waitlist: false), 3, Reply.Going);
        var waiting = Respond(full, Rules(capacity: 2, waitlist: true), 3, Reply.Going);

        Assert.Equal("sessions.round-full", refused.Error.Code);
        Assert.Equal(AttendanceStatus.Waitlisted, StatusOf(waiting.Value.Round, 3));
    }

    [Fact]
    public void A8_WithoutLimit_EveryoneGoes_AndTurningTheLimitOffPromotesTheLine()
    {
        var unlimited = Rules(limited: false, capacity: 2);
        Assert.All(Enumerable.Range(1, 20), n => Assert.Equal(AttendanceStatus.Going, StatusOf(Answer(NewRound(), unlimited, n, Reply.Going), n)));

        var round = Going(NewRound(), Rules(capacity: 2), 5);
        var change = RoundReconciliation.Reconcile(round, unlimited, Members(5), Now);

        Assert.Equal([Member(3), Member(4), Member(5)], change.Events.OfType<WaitlistPromoted>().Select(e => e.MemberId));
        Assert.Empty(change.Round.Waitlist);
    }

    [Fact]
    public void A9_MoreSpots_PromoteInOrder_FewerSpots_TakeNobodyOut()
    {
        var round = Going(NewRound(), Rules(capacity: 12), 15);

        var wider = RoundReconciliation.Reconcile(round, Rules(capacity: 14), Members(15), Now);
        Assert.Equal([Member(13), Member(14)], wider.Events.OfType<WaitlistPromoted>().Select(e => e.MemberId));
        Assert.Equal(1, wider.Round.PositionOf(Member(15)));

        var narrower = RoundReconciliation.Reconcile(wider.Round, Rules(capacity: 10), Members(15), Now);
        Assert.True(narrower.IsEmpty);
        Assert.Equal(14, narrower.Round.SpotsHeld);
        Assert.Equal(AttendanceStatus.Waitlisted, StatusOf(Answer(narrower.Round, Rules(capacity: 10), 16, Reply.Going), 16));
    }

    [Fact]
    public void A10_AttendanceOff_RefusesBothAnswers()
    {
        var off = Rules(enabled: false);

        Assert.Equal("sessions.attendance-disabled", Respond(NewRound(), off, 1, Reply.Going).Error.Code);
        Assert.Equal("sessions.attendance-disabled", Respond(NewRound(), off, 1, Reply.NotGoing).Error.Code);
    }

    [Fact]
    public void A11_Canceled_RefusesEveryone_AndKeepsTheAttendances()
    {
        var rules = Rules();
        var round = Going(NewRound(), rules, 2);
        var canceled = round.Cancel().Round;

        Assert.Equal("sessions.round-closed", Respond(canceled, rules, 3, Reply.Going).Error.Code);
        Assert.Equal("sessions.round-closed", Respond(canceled, rules, 1, Reply.NotGoing, ResponseActor.Admin).Error.Code);
        Assert.Equal(2, canceled.SpotsHeld);
        Assert.True(canceled.Cancel().IsEmpty);
    }

    [Fact]
    public void A12_AfterTheStart_PlayerIsClosedOut_AdminIsNot_AndStillRespectsTheSpots()
    {
        var rules = Rules(capacity: 1);
        var round = Going(NewRound(), rules, 1);
        var after = round.Slot.StartsAt.AddMinutes(1);

        Assert.Equal("sessions.round-closed", Respond(round, rules, 2, Reply.Going, now: after).Error.Code);
        Assert.Equal(AttendanceStatus.Waitlisted, StatusOf(Answer(round, rules, 2, Reply.Going, ResponseActor.Admin, now: after), 2));
        Assert.True(Respond(round, rules, 2, Reply.Going, now: round.Slot.StartsAt).IsSuccess);
    }

    [Fact]
    public void A12b_AfterTheRoundEnded_PlayerIsRefused_AdminStillCorrectsTheAttendance()
    {
        var rules = Rules(capacity: 2);
        var round = Going(NewRound(), rules, 1);
        var early = round.Slot.StartsAt.AddHours(-2);
        var normal = round.Slot.StartsAt.AddHours(1);

        foreach (var (ended, now) in new[]
        {
            (round.Close(early, hasFinishedMatch: true).Value.Round, early),
            (round.Close(normal, hasFinishedMatch: false).Value.Round, normal),
        })
        {
            Assert.Equal("sessions.round-closed", Respond(ended, rules, 2, Reply.Going, now: now).Error.Code);
            Assert.True(Respond(ended, rules, 2, Reply.Going, ResponseActor.Admin, now: now).IsSuccess);
            Assert.True(Respond(ended, rules, 1, Reply.NotGoing, ResponseActor.Admin, now: now).IsSuccess);
        }
    }

    [Fact]
    public void A13_ReconcileDropsWhoLeftTheGroup_AndPromotesTheFirstInLine()
    {
        var rules = Rules(capacity: 2);
        var round = Going(NewRound(), rules, 4);

        var change = RoundReconciliation.Reconcile(round, rules, Members(4).Except([Member(1)]).ToHashSet(), Now);

        Assert.Equal(AttendanceStatus.NotGoing, StatusOf(change.Round, 1));
        Assert.Equal(AttendanceStatus.Promoted, StatusOf(change.Round, 3));
        Assert.Equal(AttendanceStatus.Waitlisted, StatusOf(change.Round, 4));
    }

    [Fact]
    public void Reconcile_LeavesACanceledRoundAlone()
    {
        var rules = Rules(capacity: 1);
        var round = Going(NewRound(), rules, 2).Cancel().Round;

        Assert.True(RoundReconciliation.Reconcile(round, Rules(capacity: 2), Members(2), Now).IsEmpty);
    }

    private static HashSet<Sacou.Shared.Members.MemberId> Members(int count) =>
        [.. Enumerable.Range(1, count).Select(Member)];
}
