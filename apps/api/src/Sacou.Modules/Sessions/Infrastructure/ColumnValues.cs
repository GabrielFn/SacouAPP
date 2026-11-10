using System.Collections.Immutable;
using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Domain.Rounds;

namespace Sacou.Modules.Sessions.Infrastructure;

/// <summary>
/// The text each enum value has in the database, written by hand so reordering or renaming an enum never
/// changes stored data. The CHECK constraints are built from the same lists.
/// </summary>
internal static class ColumnValues
{
    public static readonly ImmutableDictionary<RoundStatus, string> RoundStatuses = ImmutableDictionary<RoundStatus, string>.Empty
        .Add(RoundStatus.Scheduled, "scheduled")
        .Add(RoundStatus.Canceled, "canceled");

    public static readonly ImmutableDictionary<AttendanceStatus, string> AttendanceStatuses = ImmutableDictionary<AttendanceStatus, string>.Empty
        .Add(AttendanceStatus.Going, "going")
        .Add(AttendanceStatus.NotGoing, "not_going")
        .Add(AttendanceStatus.Waitlisted, "waitlisted")
        .Add(AttendanceStatus.Promoted, "promoted");

    public static readonly ImmutableDictionary<AttendanceSource, string> AttendanceSources = ImmutableDictionary<AttendanceSource, string>.Empty
        .Add(AttendanceSource.Self, "self")
        .Add(AttendanceSource.Admin, "admin")
        .Add(AttendanceSource.Regular, "regular");

    public static string Canceled => RoundStatuses[RoundStatus.Canceled];

    public static string PromotedStatus => AttendanceStatuses[AttendanceStatus.Promoted];
}
