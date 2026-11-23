using Sacou.Modules.Sessions.Domain.Attendances;

namespace Sacou.Modules.Sessions.AccountData;

/// <summary>The attendances of a set of member ids, for the personal data export (E3.16): by the index on <c>member_id</c>.</summary>
internal interface IAccountAttendanceReader
{
    /// <summary>Ordered by the round's local date and time, then the round id; empty for no member.</summary>
    Task<IReadOnlyList<AccountAttendance>> ListOfMembersAsync(IReadOnlyCollection<Guid> members, CancellationToken cancellationToken);
}

/// <summary>
/// One attendance of the person, with the round it belongs to, as the store reads it. <c>TeamNumber</c> and
/// <c>ReservePosition</c> are the person's place in the round's published teams (ADR 0078), null when not there.
/// </summary>
internal sealed record AccountAttendance(
    Guid RoundId,
    Guid GroupId,
    Guid MemberId,
    DateOnly LocalDate,
    TimeOnly LocalTime,
    string TimeZone,
    AttendanceStatus Status,
    AttendanceSource Source,
    DateTimeOffset RespondedAt,
    DateTimeOffset? PromotedAt,
    int? TeamNumber = null,
    int? ReservePosition = null);
