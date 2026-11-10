using System.Collections.Immutable;
using Sacou.Modules.Sessions.Domain;
using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Domain.Series;
using Sacou.Shared.Members;

namespace Sacou.Modules.Sessions.Infrastructure;

/// <summary>Rows to domain values and back, by hand (no AutoMapper). Enums go through <see cref="ColumnValues"/>.</summary>
internal static class RowMapping
{
    private const int IsoSunday = 7;

    public static Round ToRound(RoundRow row, IEnumerable<AttendanceRow> attendances) => new(
        new RoundId(row.Id),
        new GroupId(row.GroupId),
        row.SeriesId is { } series ? new SeriesId(series) : null,
        new RoundSlot(row.LocalDate, row.LocalTime, row.TimeZone, row.StartsAt),
        Venue.FromStored(row.Venue),
        row.SettingsLayer,
        ColumnValues.Parse(ColumnValues.RoundStatuses, row.Status),
        row.NextSequence,
        [.. attendances.Select(ToAttendance)]);

    public static RoundRow ToRow(Round round, DateTimeOffset createdAt) => new()
    {
        Id = round.Id.Value,
        GroupId = round.GroupId.Value,
        SeriesId = round.SeriesId?.Value,
        LocalDate = round.Slot.Date,
        LocalTime = round.Slot.Time,
        TimeZone = round.Slot.TimeZoneId,
        StartsAt = round.Slot.StartsAt.ToUniversalTime(),
        Venue = round.Venue.Value,
        SettingsLayer = round.SettingsLayerJson,
        Status = ColumnValues.RoundStatuses[round.Status],
        NextSequence = round.NextSequence,
        CreatedAt = createdAt,
    };

    public static Attendance ToAttendance(AttendanceRow row) => new(
        new MemberId(row.MemberId),
        ColumnValues.Parse(ColumnValues.AttendanceStatuses, row.Status),
        row.Sequence,
        ColumnValues.Parse(ColumnValues.AttendanceSources, row.Source),
        row.RespondedAt,
        row.PromotedAt);

    public static AttendanceRow ToRow(RoundId round, Attendance attendance) => new()
    {
        RoundId = round.Value,
        MemberId = attendance.Member.Value,
        Status = ColumnValues.AttendanceStatuses[attendance.Status],
        Sequence = attendance.Sequence,
        Source = ColumnValues.AttendanceSources[attendance.Source],
        RespondedAt = attendance.RespondedAt.ToUniversalTime(),
        PromotedAt = attendance.PromotedAt?.ToUniversalTime(),
    };

    public static RoundSeries ToSeries(SeriesRow row) => new(
        new SeriesId(row.Id),
        new GroupId(row.GroupId),
        row.Weekday == IsoSunday ? DayOfWeek.Sunday : (DayOfWeek)row.Weekday,
        row.LocalTime,
        Venue.FromStored(row.Venue),
        row.TimeZone,
        row.StoppedAt);

    public static SeriesRow ToRow(RoundSeries series, DateTimeOffset createdAt) => new()
    {
        Id = series.Id.Value,
        GroupId = series.GroupId.Value,
        Weekday = series.Weekday == DayOfWeek.Sunday ? (short)IsoSunday : (short)series.Weekday,
        LocalTime = series.LocalTime,
        Venue = series.Venue.Value,
        TimeZone = series.TimeZoneId,
        CreatedAt = createdAt,
        StoppedAt = series.StoppedAt?.ToUniversalTime(),
    };

    public static ImmutableArray<SeriesOccurrence> ToOccurrences(IEnumerable<RoundRow> rows) =>
        [.. rows.Select(row => new SeriesOccurrence(
            row.LocalDate, row.StartsAt, ColumnValues.Parse(ColumnValues.RoundStatuses, row.Status) == RoundStatus.Canceled))];
}
