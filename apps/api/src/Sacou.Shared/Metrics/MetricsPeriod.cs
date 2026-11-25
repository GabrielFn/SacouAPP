namespace Sacou.Shared.Metrics;

/// <summary>
/// What the operator's counts are taken over (E7.2, ADR 0085, D2): the calendar of the weeks, the instant the counts are
/// taken at, and the start of the oldest week shown. Each module groups its rows by the Monday of the week in
/// <see cref="TimeZoneId"/>, in Postgres, and never sends a row back.
/// </summary>
/// <param name="TimeZoneId">The IANA zone the weeks are counted in (<c>America/Sao_Paulo</c>).</param>
/// <param name="Now">The instant of the counts: what started before it has happened.</param>
/// <param name="WeeksSince">The first instant of the oldest week shown; the weekly counts skip what came before.</param>
public sealed record MetricsPeriod(string TimeZoneId, DateTimeOffset Now, DateTimeOffset WeeksSince);

/// <summary>How many in one week, the week named by its Monday in the zone of the <see cref="MetricsPeriod"/>.</summary>
public readonly record struct WeeklyCount(DateOnly WeekStart, int Count);
