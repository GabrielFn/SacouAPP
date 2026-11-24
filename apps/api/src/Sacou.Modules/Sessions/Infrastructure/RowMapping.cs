using System.Collections.Immutable;
using Sacou.Shared.Persistence;
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

    public static Round ToRound(RoundRow row, IEnumerable<AttendanceRow> attendances, IEnumerable<RoundTeamSlotRow> teamSlots) => new(
        new RoundId(row.Id),
        new GroupId(row.GroupId),
        row.SeriesId is { } series ? new SeriesId(series) : null,
        new RoundSlot(row.LocalDate, row.LocalTime, row.TimeZone, row.StartsAt),
        Venue.FromStored(row.Venue),
        row.SettingsLayer,
        EnumColumns.Parse(ColumnValues.RoundStatuses, row.Status),
        row.NextSequence,
        [.. attendances.Select(ToAttendance)])
    {
        LinkCode = row.LinkCode is { } code ? RoundLinkCode.FromStored(code) : null,
        ClosedAt = row.ClosedAt,
        Teams = row.TeamsConfirmedAt is { } confirmedAt ? ToTeams(teamSlots, confirmedAt) : null,
    };

    /// <summary>The stored teams, trusted as written under the round's lock: in the order of the team and of the position.</summary>
    private static RoundTeams ToTeams(IEnumerable<RoundTeamSlotRow> slots, DateTimeOffset confirmedAt)
    {
        var ordered = slots.OrderBy(slot => slot.TeamNumber ?? short.MaxValue).ThenBy(slot => slot.Position).ToImmutableArray();
        var teams = ordered.Where(slot => slot.TeamNumber is not null)
            .GroupBy(slot => slot.TeamNumber)
            .Select(team => team.Select(slot => new MemberId(slot.MemberId)).ToImmutableArray())
            .ToImmutableArray();
        var reserves = ordered.Where(slot => slot.TeamNumber is null).Select(slot => new MemberId(slot.MemberId)).ToImmutableArray();
        return new RoundTeams(teams, reserves, confirmedAt);
    }

    /// <summary>One row per member of the teams, numbered from 1; the reserves with no team.</summary>
    public static IEnumerable<RoundTeamSlotRow> ToTeamRows(RoundId round, RoundTeams teams)
    {
        ArgumentNullException.ThrowIfNull(teams);
        var players = teams.Teams.SelectMany((team, teamIndex) => team.Select((member, index) => new RoundTeamSlotRow
        {
            RoundId = round.Value,
            MemberId = member.Value,
            TeamNumber = checked((short)(teamIndex + 1)),
            Position = checked((short)(index + 1)),
        }));
        var reserves = teams.Reserves.Select((member, index) => new RoundTeamSlotRow
        {
            RoundId = round.Value,
            MemberId = member.Value,
            TeamNumber = null,
            Position = checked((short)(index + 1)),
        });
        return players.Concat(reserves);
    }

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
        LinkCode = round.LinkCode?.Value,
        ClosedAt = round.ClosedAt?.ToUniversalTime(),
        TeamsConfirmedAt = round.Teams?.ConfirmedAt.ToUniversalTime(),
    };

    public static Attendance ToAttendance(AttendanceRow row) => new(
        new MemberId(row.MemberId),
        EnumColumns.Parse(ColumnValues.AttendanceStatuses, row.Status),
        row.Sequence,
        EnumColumns.Parse(ColumnValues.AttendanceSources, row.Source),
        row.RespondedAt,
        row.PromotedAt)
    {
        Channel = EnumColumns.Parse(ColumnValues.AttendanceChannels, row.Channel),
    };

    public static AttendanceRow ToRow(RoundId round, Attendance attendance) => new()
    {
        RoundId = round.Value,
        MemberId = attendance.Member.Value,
        Status = ColumnValues.AttendanceStatuses[attendance.Status],
        Sequence = attendance.Sequence,
        Source = ColumnValues.AttendanceSources[attendance.Source],
        RespondedAt = attendance.RespondedAt.ToUniversalTime(),
        PromotedAt = attendance.PromotedAt?.ToUniversalTime(),
        Channel = ColumnValues.AttendanceChannels[attendance.Channel],
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
            row.LocalDate, row.StartsAt, EnumColumns.Parse(ColumnValues.RoundStatuses, row.Status) == RoundStatus.Canceled))];
}
