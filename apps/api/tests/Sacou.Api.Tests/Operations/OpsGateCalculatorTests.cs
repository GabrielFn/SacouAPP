using Sacou.Api.Operations;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Contracts;
using Xunit;

namespace Sacou.Api.Tests.Operations;

/// <summary>Criteria 19 to 22 of E7.2 (question 215): the gate's rates, the weeks in a row, and the groups that meet it.</summary>
public sealed class OpsGateCalculatorTests
{
    private static readonly Guid Quinta = Guid.Parse("0198a7c0-0000-7000-8000-000000000001");
    private static readonly Guid Sabado = Guid.Parse("0198a7c0-0000-7000-8000-000000000002");
    private static readonly DateOnly Week1 = new(2026, 10, 5);

    private static DateOnly Week(int number) => Week1.AddDays(7 * (number - 1));

    /// <summary>A week of one round with <paramref name="confirmed"/> confirmed, <paramref name="self"/> by themselves.</summary>
    private static HeldWeek Held(Guid group, int week, int confirmed, int self, int byLink = 0) =>
        new(group, Week(week), Rounds: 1, confirmed, self, byLink);

    [Fact]
    public void TheExampleOfTheCriterion_Is67PercentAnd50ByTheLink()
    {
        // 3 self/web, 1 self/app and 2 admin; the 4 mensalistas are not in the Sessions' counts (source = regular).
        var count = OpsGateCalculator.Count([new HeldWeek(Quinta, Week1, 1, Confirmed: 6, SelfAnswered: 4, ByLink: 3)]);

        Assert.Equal(4.0 / 6, count.Rate);
        Assert.Equal(0.5, count.LinkRate);
    }

    [Fact]
    public void NoConfirmed_IsANullRate_NeverZero()
    {
        var count = OpsGateCalculator.Count([]);

        Assert.Null(count.Rate);
        Assert.Null(count.LinkRate);
        Assert.Equal(0, count.Rounds);
        Assert.Null(OpsGateCalculator.Rate(0, 0));
        Assert.Equal(0.0, OpsGateCalculator.Rate(0, 3));
    }

    [Fact]
    public void EveryWeekShown_IsThere_WithANullRateWhenNoRoundWasHeld()
    {
        var weeks = Enumerable.Range(1, 8).Select(Week).ToList();

        var gate = OpsGateCalculator.Gate([Held(Quinta, 2, 10, 7), Held(Sabado, 2, 10, 3), Held(Quinta, 30, 10, 10)], [], weeks);

        Assert.Equal(weeks, gate.Weeks.Select(week => week.WeekStart));
        Assert.Null(gate.Weeks[0].Count.Rate);
        Assert.Equal(0.5, gate.Weeks[1].Count.Rate);
        Assert.Equal(2, gate.Weeks[1].Count.Rounds);
        Assert.Equal(30, gate.Total.Confirmed);
        Assert.Equal(0.6, gate.Target);
        Assert.Equal(4, gate.RequiredWeeks);
        Assert.Equal(5, gate.GroupsGoal);
    }

    [Theory]
    [InlineData(new[] { 1, 2, 3, 4 }, new[] { 70, 60, 65, 80 }, true, 4)]
    [InlineData(new[] { 1, 2, 4, 5 }, new[] { 70, 60, 65, 80 }, false, 2)]
    [InlineData(new[] { 1, 2, 3, 4 }, new[] { 70, 59, 65, 80 }, false, 4)]
    [InlineData(new[] { 1, 2, 3, 4, 5 }, new[] { 59, 60, 60, 60, 60 }, true, 5)]
    [InlineData(new[] { 1, 2, 3 }, new[] { 100, 100, 100 }, false, 3)]
    [InlineData(new[] { 3, 1, 4, 2 }, new[] { 61, 61, 61, 61 }, true, 4)]
    public void AGroupMeetsTheGate_OnlyWithFourWeeksInARowAtSixtyPercent(int[] weeks, int[] percents, bool meets, int streak)
    {
        var held = weeks.Zip(percents, (week, percent) => Held(Quinta, week, 100, percent)).ToList();

        var group = Assert.Single(OpsGateCalculator.Gate(held, [new CountedGroup(Quinta, "Vôlei de quinta", DateTimeOffset.UnixEpoch)], []).ByGroup);

        Assert.Equal(meets, group.MeetsGate);
        Assert.Equal(streak, group.LongestStreak);
    }

    [Fact]
    public void AWeekWithoutConfirmed_BreaksTheRunAtTheTarget_ButNotTheStreak()
    {
        HeldWeek[] held = [Held(Quinta, 1, 10, 9), Held(Quinta, 2, 0, 0), Held(Quinta, 3, 10, 9), Held(Quinta, 4, 10, 9), Held(Quinta, 5, 10, 9)];

        var group = Assert.Single(OpsGateCalculator.Gate(held, [new CountedGroup(Quinta, "Q", DateTimeOffset.UnixEpoch)], []).ByGroup);

        Assert.Equal(5, group.LongestStreak);
        Assert.False(group.MeetsGate);
    }

    [Fact]
    public void TheGroups_ComeInTheOrderOfTheList_WithTheirOwnWeeks_AndTheCountMeeting()
    {
        HeldWeek[] held = [.. Enumerable.Range(1, 4).Select(week => Held(Sabado, week, 10, 6)), Held(Quinta, 1, 10, 1)];
        CountedGroup[] groups =
        [
            new(Quinta, "Vôlei de quinta", DateTimeOffset.UnixEpoch),
            new(Sabado, "Sábado na praia", DateTimeOffset.UnixEpoch.AddDays(1)),
            new(Guid.Parse("0198a7c0-0000-7000-8000-000000000003"), "Sem rodada", DateTimeOffset.UnixEpoch.AddDays(2)),
        ];

        var gate = OpsGateCalculator.Gate(held, groups, []);

        Assert.Equal(["Vôlei de quinta", "Sábado na praia", "Sem rodada"], gate.ByGroup.Select(group => group.Name));
        Assert.Equal([1, 4, 0], gate.ByGroup.Select(group => group.Count.Rounds));
        Assert.Equal([false, true, false], gate.ByGroup.Select(group => group.MeetsGate));
        Assert.Null(gate.ByGroup[2].Count.Rate);
        Assert.Equal(1, gate.GroupsMeeting);
    }
}
