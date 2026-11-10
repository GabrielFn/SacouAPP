namespace Sacou.Modules.Sessions.Domain.Time;

/// <summary>A local date and time in a zone, and the instant they mean. The local time may differ from the one asked (see below).</summary>
internal readonly record struct ZonedMoment(DateOnly Date, TimeOnly Time, DateTimeOffset Instant);

/// <summary>
/// Local time to instant, with the two daylight-saving edges decided here (ADR 0043, D4). A time that does
/// not exist (midnight to 1am on 04/11/2018) moves forward by the length of the jump; an ambiguous time
/// (23h on 16/02/2019, which happened twice) keeps the first occurrence, the daylight one.
/// </summary>
internal static class LocalTimeConverter
{
    public static ZonedMoment ToMoment(DateOnly date, TimeOnly time, TimeZoneInfo zone)
    {
        var local = date.ToDateTime(time, DateTimeKind.Unspecified);
        if (zone.IsInvalidTime(local))
        {
            return AfterTheJump(local, zone);
        }

        var offset = zone.IsAmbiguousTime(local) ? zone.GetAmbiguousTimeOffsets(local).Max() : zone.GetUtcOffset(local);
        return new ZonedMoment(date, time, new DateTimeOffset(local, offset).ToUniversalTime());
    }

    /// <summary>For an invalid time the offset is the standard one, from before the jump; the same instant seen locally is past it.</summary>
    private static ZonedMoment AfterTheJump(DateTime local, TimeZoneInfo zone)
    {
        var instant = new DateTimeOffset(local, zone.GetUtcOffset(local)).ToUniversalTime();
        var shifted = TimeZoneInfo.ConvertTime(instant, zone).DateTime;
        return new ZonedMoment(DateOnly.FromDateTime(shifted), TimeOnly.FromDateTime(shifted), instant);
    }
}
