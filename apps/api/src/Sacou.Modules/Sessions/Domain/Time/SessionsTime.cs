namespace Sacou.Modules.Sessions.Domain.Time;

/// <summary>
/// The one time zone of the MVP, stored in every round and series so a zone per group needs no data migration
/// (ADR 0043, D4). IANA ids work on Linux and, with ICU, on Windows (.NET 10).
/// </summary>
internal static class SessionsTime
{
    public const string TimeZoneId = "America/Sao_Paulo";

    private static readonly Lazy<TimeZoneInfo> Zone = new(() => TimeZoneInfo.FindSystemTimeZoneById(TimeZoneId));

    public static TimeZoneInfo TimeZone => Zone.Value;

    public static DateOnly LocalDateOf(DateTimeOffset instant, TimeZoneInfo zone) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(instant, zone).DateTime);
}
