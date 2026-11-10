using Sacou.Modules.Sessions.Domain;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Domain.Series;
using Xunit;
using static Sacou.Modules.Sessions.Tests.RoundFixture;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>R1 to R7: which date a weekly series makes next (ADR 0043, D3). Tuesdays at 20:30 local (23:30 UTC).</summary>
public sealed class RecurrenceTests
{
    private static readonly DateOnly FirstTuesday = new(2026, 11, 17);
    private static readonly TimeOnly EightThirty = new(20, 30);
    private static readonly RoundSeries Tuesdays = Series();

    [Fact]
    public void TheFixtureDateIsATuesday() => Assert.Equal(DayOfWeek.Tuesday, FirstTuesday.DayOfWeek);

    [Fact]
    public void R1_CreatedOnAThursday_TheNextIsTheFollowingTuesday()
    {
        var thursday = new DateTimeOffset(2026, 11, 12, 12, 0, 0, TimeSpan.Zero);

        Assert.Equal(FirstTuesday, RoundSchedule.NextOccurrence(Tuesdays, [], thursday));
    }

    [Fact]
    public void R2_OnTheDayBeforeItStarts_TodaysIsMade_AfterItStarted_NextWeeks()
    {
        var at19 = new DateTimeOffset(2026, 11, 17, 22, 0, 0, TimeSpan.Zero);
        var at21 = new DateTimeOffset(2026, 11, 18, 0, 0, 0, TimeSpan.Zero);

        Assert.Equal(FirstTuesday, RoundSchedule.NextOccurrence(Tuesdays, [], at19));
        Assert.Equal(FirstTuesday.AddDays(7), RoundSchedule.NextOccurrence(Tuesdays, [], at21));
    }

    [Fact]
    public void R3_AFutureOccurrenceThatIsActive_MeansNothingToMake()
    {
        Assert.Null(RoundSchedule.NextOccurrence(Tuesdays, [Occurrence(FirstTuesday, canceled: false)], Now));
    }

    [Fact]
    public void R4_AFutureOccurrenceThatWasCanceled_MakesTheFollowingOne()
    {
        var next = RoundSchedule.NextOccurrence(Tuesdays, [Occurrence(FirstTuesday, canceled: true)], Now);

        Assert.Equal(FirstTuesday.AddDays(7), next);
    }

    [Fact]
    public void R5_NobodyReadForFiveWeeks_MakesOnlyTheNextFutureOne()
    {
        var old = Occurrence(FirstTuesday.AddDays(-5 * 7), canceled: false);
        var weeksLater = new DateTimeOffset(2026, 12, 22, 12, 0, 0, TimeSpan.Zero);

        var next = RoundSchedule.NextOccurrence(Tuesdays, [old], weeksLater);

        Assert.Equal(new DateOnly(2026, 12, 22), next);
        Assert.Null(RoundSchedule.NextOccurrence(Tuesdays, [old, Occurrence(next!.Value, canceled: false)], weeksLater));
    }

    [Fact]
    public void R6_AStoppedSeries_MakesNothing_AndStoppingTwiceChangesNothing()
    {
        var stopped = Tuesdays.Stop(Now);

        Assert.Null(RoundSchedule.NextOccurrence(stopped, [], Now));
        Assert.Equal(stopped, stopped.Stop(Now.AddDays(1)));
        Assert.False(stopped.IsActive);
    }

    [Fact]
    public void R7_AnOccurrenceBornFromTheSeries_HasNoLayer_ButAnExplicitOneKeepsIt()
    {
        var made = Tuesdays.Occur(RoundId.New(Now), FirstTuesday);
        var manual = Round.Create(RoundId.New(Now), Group, Tuesdays.Id, RoundSlot.At(FirstTuesday, EightThirty), Venue.Empty, "{\"schemaVersion\":1}");

        Assert.Null(made.Round.SettingsLayerJson);
        Assert.Equal(Tuesdays.Id, made.Round.SeriesId);
        Assert.Equal(new DateTimeOffset(2026, 11, 17, 23, 30, 0, TimeSpan.Zero), made.Round.Slot.StartsAt);
        Assert.Equal("{\"schemaVersion\":1}", manual.Round.SettingsLayerJson);
        Assert.Single(made.Events.OfType<RoundCreated>());
    }

    [Fact]
    public void TheSeriesTakesItsWeekdayFromTheFirstDate()
    {
        var wednesday = RoundSeries.Start(SeriesId.New(Now), Group, FirstTuesday.AddDays(1), EightThirty, Venue.Empty);

        Assert.Equal(DayOfWeek.Wednesday, wednesday.Weekday);
        Assert.Equal("America/Sao_Paulo", wednesday.TimeZoneId);
    }

    private static RoundSeries Series() => RoundSeries.Start(SeriesId.New(Now), Group, FirstTuesday, EightThirty, Venue.Empty);

    private static SeriesOccurrence Occurrence(DateOnly date, bool canceled) =>
        new(date, RoundSlot.At(date, EightThirty).StartsAt, canceled);
}
