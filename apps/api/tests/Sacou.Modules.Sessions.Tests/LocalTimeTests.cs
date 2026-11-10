using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Domain.Time;
using Xunit;
using static Sacou.Modules.Sessions.Tests.RoundFixture;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>T1 to T8: local time, instants and the two daylight-saving edges of São Paulo (ADR 0043, D4).</summary>
public sealed class LocalTimeTests
{
    private static readonly TimeZoneInfo Zone = SessionsTime.TimeZone;

    [Fact]
    public void T1_LocalTimeBecomesTheUtcInstant()
    {
        var slot = RoundSlot.At(new DateOnly(2026, 11, 17), new TimeOnly(20, 30));

        Assert.Equal(new DateTimeOffset(2026, 11, 17, 23, 30, 0, TimeSpan.Zero), slot.StartsAt);
        Assert.Equal("America/Sao_Paulo", slot.TimeZoneId);
    }

    [Fact]
    public void T2_LateEvening_IsTheNextDayInUtc_AndMidnightIsKept()
    {
        var late = RoundSlot.At(new DateOnly(2026, 11, 17), new TimeOnly(23, 59));
        var midnight = RoundSlot.At(new DateOnly(2026, 11, 18), new TimeOnly(0, 0));

        Assert.Equal(new DateTimeOffset(2026, 11, 18, 2, 59, 0, TimeSpan.Zero), late.StartsAt);
        Assert.Equal(new DateOnly(2026, 11, 18), late.Date.AddDays(1));
        Assert.Equal(new TimeOnly(0, 0), midnight.Time);
        Assert.Equal(new DateTimeOffset(2026, 11, 18, 3, 0, 0, TimeSpan.Zero), midnight.StartsAt);
    }

    [Theory]
    [InlineData("2026-02-30", false)]
    [InlineData("2026-13-01", false)]
    [InlineData("2026-1-5", false)]
    [InlineData("17/11/2026", false)]
    [InlineData("2026-11-17T00:00", false)]
    [InlineData(" 2026-11-17", false)]
    [InlineData("", false)]
    [InlineData("2026-11-17", true)]
    public void T3_Dates_AcceptOnlyTheWireFormat(string text, bool valid)
    {
        var parsed = LocalInput.ParseDate(text);

        Assert.Equal(valid, parsed.IsSuccess);
        Assert.True(valid || parsed.Error.Code == "sessions.round-invalid");
    }

    [Theory]
    [InlineData("24:00", false)]
    [InlineData("20:60", false)]
    [InlineData("8:00", false)]
    [InlineData("20:30:00", false)]
    [InlineData("8h", false)]
    [InlineData("", false)]
    [InlineData("08:00", true)]
    [InlineData("23:59", true)]
    public void T3_Times_AcceptOnlyTheWireFormat(string text, bool valid)
    {
        var parsed = LocalInput.ParseTime(text);

        Assert.Equal(valid, parsed.IsSuccess);
        Assert.True(valid || parsed.Error.Code == "sessions.round-invalid");
    }

    [Fact]
    public void T3_NullInput_IsRefused()
    {
        Assert.True(LocalInput.ParseDate(null).IsFailure);
        Assert.True(LocalInput.ParseTime(null).IsFailure);
    }

    [Fact]
    public void T4_RequestedSlot_MustBeInTheFuture_AndWithinAYear()
    {
        var time = new TimeOnly(20, 30);
        var today = new DateOnly(2026, 11, 10);

        Assert.True(RoundSlot.Request(today.AddDays(-1), time, Now).IsFailure);
        Assert.True(RoundSlot.Request(today, new TimeOnly(8, 0), Now).IsFailure);
        Assert.True(RoundSlot.Request(today, new TimeOnly(9, 0), Now).IsFailure);
        Assert.True(RoundSlot.Request(today, time, Now).IsSuccess);
        Assert.True(RoundSlot.Request(today.AddDays(365), time, Now).IsSuccess);
        Assert.Equal("sessions.round-invalid", RoundSlot.Request(today.AddDays(366), time, Now).Error.Code);
    }

    [Fact]
    public void T5_ATimeThatDoesNotExist_MovesForwardByTheJump()
    {
        var moment = LocalTimeConverter.ToMoment(new DateOnly(2018, 11, 4), new TimeOnly(0, 30), Zone);

        Assert.Equal(new DateOnly(2018, 11, 4), moment.Date);
        Assert.Equal(new TimeOnly(1, 30), moment.Time);
        Assert.Equal(new DateTimeOffset(2018, 11, 4, 3, 30, 0, TimeSpan.Zero), moment.Instant);
    }

    [Fact]
    public void T6_AnAmbiguousTime_KeepsTheFirstOccurrence()
    {
        var moment = LocalTimeConverter.ToMoment(new DateOnly(2019, 2, 16), new TimeOnly(23, 30), Zone);

        Assert.Equal(new TimeOnly(23, 30), moment.Time);
        Assert.Equal(new DateTimeOffset(2019, 2, 17, 1, 30, 0, TimeSpan.Zero), moment.Instant);
    }

    [Fact]
    public void T7_Weekly_KeepsTheLocalTime_AcrossTheChangeOfHour()
    {
        var before = RoundSlot.At(new DateOnly(2018, 10, 28), new TimeOnly(20, 30));
        var after = RoundSlot.At(new DateOnly(2018, 11, 4), new TimeOnly(20, 30));

        Assert.Equal(new TimeOnly(20, 30), after.Time);
        Assert.Equal(TimeSpan.FromDays(7) - TimeSpan.FromHours(1), after.StartsAt - before.StartsAt);
    }

    [Fact]
    public void T8_DropInOpensAt_IsAnInstantCalculation_AlsoAcrossTheChange()
    {
        var slot = RoundSlot.At(new DateOnly(2018, 11, 4), new TimeOnly(20, 30));

        Assert.Equal(slot.StartsAt - TimeSpan.FromHours(24), slot.DropInOpensAt(24));
        Assert.Equal(new DateTimeOffset(2018, 11, 3, 22, 30, 0, TimeSpan.Zero), slot.DropInOpensAt(24));
    }

    [Theory]
    [InlineData("", true)]
    [InlineData("Quadra da praia", true)]
    [InlineData("  Quadra  ", true)]
    [InlineData("​", false)]
    [InlineData("!!!", false)]
    public void Venue_FollowsTheVisibleTextRule(string text, bool valid)
    {
        Assert.Equal(valid, Domain.Venue.Create(text).IsSuccess);
    }

    [Fact]
    public void Venue_IsTrimmed_LimitedTo80Characters_AndNeverPrinted()
    {
        Assert.Equal("Quadra", Domain.Venue.Create("  Quadra ").Value.Value);
        Assert.True(Domain.Venue.Create(new string('a', 80)).IsSuccess);
        Assert.True(Domain.Venue.Create(new string('a', 81)).IsFailure);
        Assert.Equal("Venue", Domain.Venue.Create("Casa do João").Value.ToString());
    }
}
