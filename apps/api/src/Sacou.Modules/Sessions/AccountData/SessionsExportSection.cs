using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Sessions.Domain.Attendances;

namespace Sacou.Modules.Sessions.AccountData;

/// <summary>
/// "Presenças nas rodadas" of screen 30a (E3.16, ADR 0056, D9): the person's own answers in every round of every
/// membership they have or had, soonest round first. The member ids come from the Groups contract, so the Sessions
/// never reads the Groups tables. Never another member's attendance, nor the round's venue (group data).
/// </summary>
internal sealed class SessionsExportSection(IGroupMembership membership, IAccountAttendanceReader attendances) : IAccountExportSection
{
    public string Name => AccountExportSections.Attendances;

    public int Order => AccountExportSections.AttendancesOrder;

    public async Task<object?> ExportAsync(Guid userId, CancellationToken cancellationToken)
    {
        var members = await membership.ListMemberIdsOfUserAsync(userId, cancellationToken).ConfigureAwait(false);
        var found = await attendances.ListOfMembersAsync(members, cancellationToken).ConfigureAwait(false);
        return found.Select(ToEntry).ToList();
    }

    private static AttendanceExportEntry ToEntry(AccountAttendance attendance) => new(
        attendance.RoundId,
        attendance.GroupId,
        attendance.MemberId,
        attendance.LocalDate,
        attendance.LocalTime,
        attendance.TimeZone,
        ToExport(attendance.Status),
        ToExport(attendance.Source),
        attendance.RespondedAt,
        attendance.PromotedAt,
        attendance.TeamNumber,
        attendance.ReservePosition);

    private static ExportedAttendanceStatus ToExport(AttendanceStatus status) => status switch
    {
        AttendanceStatus.Going => ExportedAttendanceStatus.Going,
        AttendanceStatus.NotGoing => ExportedAttendanceStatus.NotGoing,
        AttendanceStatus.Waitlisted => ExportedAttendanceStatus.Waitlisted,
        AttendanceStatus.Promoted => ExportedAttendanceStatus.Promoted,
        _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Every status needs an exported twin."),
    };

    private static ExportedAttendanceSource ToExport(AttendanceSource source) => source switch
    {
        AttendanceSource.Self => ExportedAttendanceSource.Self,
        AttendanceSource.Admin => ExportedAttendanceSource.Admin,
        AttendanceSource.Regular => ExportedAttendanceSource.Regular,
        _ => throw new ArgumentOutOfRangeException(nameof(source), source, "Every source needs an exported twin."),
    };
}

/// <summary>
/// One attendance in the export: the round it belongs to, the person's member id there, and the answer; with the
/// person's place in the published teams (ADR 0078), the team's number or the place in the queue of reserves.
/// </summary>
internal sealed record AttendanceExportEntry(
    Guid RoundId,
    Guid GroupId,
    Guid MemberId,
    DateOnly LocalDate,
    TimeOnly LocalTime,
    string TimeZone,
    ExportedAttendanceStatus Status,
    ExportedAttendanceSource Source,
    DateTimeOffset RespondedAt,
    DateTimeOffset? PromotedAt,
    int? TeamNumber,
    int? ReservePosition);

/// <summary>The attendance status as the export writes it, converted by hand so the domain enum stays free to change.</summary>
internal enum ExportedAttendanceStatus
{
    Going,
    NotGoing,
    Waitlisted,
    Promoted,
}

/// <summary>Who answered, as the export writes it.</summary>
internal enum ExportedAttendanceSource
{
    Self,
    Admin,
    Regular,
}
