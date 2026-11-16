using Sacou.Modules.Sessions.AccountData;

namespace Sacou.Modules.Sessions.Infrastructure;

/// <summary>The attendances of a set of member ids, for the personal data export (E3.16): by the index on <c>member_id</c>.</summary>
internal interface IAccountAttendanceReader
{
    /// <summary>Ordered by the round's local date and time, then the round id; empty for no member.</summary>
    Task<IReadOnlyList<AttendanceExportEntry>> ListOfMembersAsync(IReadOnlyCollection<Guid> members, CancellationToken cancellationToken);
}
