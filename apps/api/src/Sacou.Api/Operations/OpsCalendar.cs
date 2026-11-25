using Sacou.Shared.Metrics;

namespace Sacou.Api.Operations;

/// <summary>
/// The weeks of the dashboard (E7.2, ADR 0085, D3): Monday to Sunday in São Paulo, the pilot's zone, the current week
/// included (partial) and the seven before it. A week is named by its Monday, the same date Postgres'
/// <c>date_trunc('week', …)</c> gives the local time.
/// </summary>
internal static class OpsCalendar
{
    public const string TimeZoneId = "America/Sao_Paulo";

    /// <summary>The weeks shown, the current one included.</summary>
    public const int WeekCount = 8;

    private const int DaysPerWeek = 7;

    public static TimeZoneInfo Zone { get; } = TimeZoneInfo.FindSystemTimeZoneById(TimeZoneId);

    /// <summary>The Mondays of the weeks shown, the oldest first.</summary>
    public static IReadOnlyList<DateOnly> Weeks(DateTimeOffset now)
    {
        var current = MondayOf(DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now, Zone).DateTime));
        return [.. Enumerable.Range(0, WeekCount).Select(index => current.AddDays(-DaysPerWeek * (WeekCount - 1 - index)))];
    }

    /// <summary>The counts' period: now, and the first instant of the oldest week shown.</summary>
    public static MetricsPeriod PeriodAt(DateTimeOffset now) => new(TimeZoneId, now, StartOf(Weeks(now)[0]));

    /// <summary>The Monday of a date's week.</summary>
    public static DateOnly MondayOf(DateOnly date) => date.AddDays(-(((int)date.DayOfWeek + DaysPerWeek - (int)DayOfWeek.Monday) % DaysPerWeek));

    /// <summary>The first instant of a local day in São Paulo.</summary>
    public static DateTimeOffset StartOf(DateOnly day)
    {
        var utc = TimeZoneInfo.ConvertTimeToUtc(day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), Zone);
        return new DateTimeOffset(utc, TimeSpan.Zero);
    }
}
