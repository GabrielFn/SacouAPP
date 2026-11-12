using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Domain.Time;

namespace Sacou.Modules.Sessions.Domain.Series;

/// <summary>An occurrence the series already made: its local date, start and whether it was cancelled.</summary>
internal readonly record struct SeriesOccurrence(DateOnly Date, DateTimeOffset StartsAt, bool IsCanceled);

/// <summary>
/// Which date a series makes next, as a pure function (ADR 0043, D3). The materializer of the application
/// layer calls it on read, idempotently, and inserts the date. Weekly means the same local time, not seven
/// days of instant, so crossing a change of hour keeps "20h30".
/// </summary>
internal static class RoundSchedule
{
    private const int DaysInWeek = 7;

    /// <summary>
    /// Null when the series is stopped or already has a future occurrence that was not cancelled. Otherwise the
    /// first date of the weekday that starts after <paramref name="now"/> and after every occurrence the series
    /// already has: a series nobody read for weeks makes one round ahead, never one in the past.
    /// </summary>
    public static DateOnly? NextOccurrence(RoundSeries series, IReadOnlyCollection<SeriesOccurrence> occurrences, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(series);
        ArgumentNullException.ThrowIfNull(occurrences);
        if (!series.IsActive || occurrences.Any(occurrence => !occurrence.IsCanceled && occurrence.StartsAt > now))
        {
            return null;
        }

        var today = SessionsTime.LocalDateOf(now, SessionsTime.TimeZone);
        var earliest = occurrences.Count == 0 ? today : Latest(today, occurrences.Max(occurrence => occurrence.Date).AddDays(1));
        return FirstWeekdayStartingAfter(series, earliest, now);
    }

    private static DateOnly Latest(DateOnly first, DateOnly second) => first > second ? first : second;

    /// <summary>At most a week and a day of looking: the weekday comes around, and today's may have started already.</summary>
    private static DateOnly? FirstWeekdayStartingAfter(RoundSeries series, DateOnly earliest, DateTimeOffset now)
    {
        foreach (var date in Enumerable.Range(0, DaysInWeek + 1).Select(offset => earliest.AddDays(offset)))
        {
            if (date.DayOfWeek == series.Weekday && RoundSlot.At(date, series.LocalTime).StartsAt > now)
            {
                return date;
            }
        }

        return null;
    }
}
