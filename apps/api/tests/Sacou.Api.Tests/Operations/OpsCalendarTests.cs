using Sacou.Api.Operations;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Metrics;
using Xunit;

namespace Sacou.Api.Tests.Operations;

/// <summary>Criterion 6 of E7.2: eight weeks, Monday to Sunday in São Paulo, the current one included, each one present.</summary>
public sealed class OpsCalendarTests
{
    /// <summary>Tuesday 24/11/2026, 15:00 in São Paulo (UTC−3).</summary>
    private static readonly DateTimeOffset Tuesday = new(2026, 11, 24, 18, 0, 0, TimeSpan.Zero);

    [Fact]
    public void TheWeeks_AreTheEightMondays_TheCurrentOneLast()
    {
        var weeks = OpsCalendar.Weeks(Tuesday);

        Assert.Equal(8, weeks.Count);
        Assert.Equal(new DateOnly(2026, 11, 23), weeks[^1]);
        Assert.Equal(new DateOnly(2026, 10, 5), weeks[0]);
        Assert.All(weeks, week => Assert.Equal(DayOfWeek.Monday, week.DayOfWeek));
    }

    /// <summary>Monday 02:30 UTC is still Sunday 23:30 in São Paulo: the week is the one before.</summary>
    [Fact]
    public void SundayNightInSaoPaulo_BelongsToTheWeekOfThatSunday()
    {
        var mondayUtc = new DateTimeOffset(2026, 11, 23, 2, 30, 0, TimeSpan.Zero);

        Assert.Equal(new DateOnly(2026, 11, 16), OpsCalendar.Weeks(mondayUtc)[^1]);
        Assert.Equal(new DateOnly(2026, 11, 23), OpsCalendar.Weeks(mondayUtc.AddMinutes(30))[^1]);
    }

    [Fact]
    public void ThePeriod_StartsAtMidnightOfTheOldestMonday_InSaoPaulo()
    {
        var period = OpsCalendar.PeriodAt(Tuesday);

        Assert.Equal("America/Sao_Paulo", period.TimeZoneId);
        Assert.Equal(Tuesday, period.Now);
        Assert.Equal(new DateTimeOffset(2026, 10, 5, 3, 0, 0, TimeSpan.Zero), period.WeeksSince);
    }

    [Theory]
    [InlineData(2026, 11, 23, 23)]
    [InlineData(2026, 11, 29, 23)]
    [InlineData(2026, 11, 30, 30)]
    [InlineData(2026, 11, 26, 23)]
    public void TheMonday_OfEachDay(int year, int month, int day, int monday)
    {
        Assert.Equal(new DateOnly(2026, 11, monday), OpsCalendar.MondayOf(new DateOnly(year, month, day)));
    }

    [Fact]
    public void Users_HaveEveryWeek_WithZeroWhenTheModuleCountedNothing()
    {
        var weeks = OpsCalendar.Weeks(Tuesday);
        var identity = new IdentityMetrics(
            Registered: 12,
            Deleted: 2,
            RegisteredByWeek: [new WeeklyCount(new DateOnly(2026, 11, 16), 3), new WeeklyCount(new DateOnly(2026, 11, 23), 1), new WeeklyCount(new DateOnly(2026, 9, 28), 9)],
            DeletedByWeek: [new WeeklyCount(new DateOnly(2026, 10, 5), 1)]);

        var users = OpsMetricsCalculator.Users(identity, weeks);

        Assert.Equal(12, users.Registered);
        Assert.Equal(2, users.Deleted);
        Assert.Equal(weeks, users.Weeks.Select(week => week.WeekStart));
        Assert.Equal([0, 0, 0, 0, 0, 0, 3, 1], users.Weeks.Select(week => week.Registered));
        Assert.Equal([1, 0, 0, 0, 0, 0, 0, 0], users.Weeks.Select(week => week.Deleted));
    }
}
