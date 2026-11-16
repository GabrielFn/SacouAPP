using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Sessions.AccountData;
using Sacou.Shared.Persistence;

namespace Sacou.Modules.Sessions.Infrastructure;

/// <summary>One parameterized query with no tracking; the member ids come from the Groups contract (ADR 0056, D6).</summary>
internal sealed class PostgresAccountAttendanceReader(SessionsDbContext database) : IAccountAttendanceReader
{
    public async Task<IReadOnlyList<AttendanceExportEntry>> ListOfMembersAsync(IReadOnlyCollection<Guid> members, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(members);
        if (members.Count == 0)
        {
            return [];
        }

        Guid[] ids = [.. members.Distinct()];
        var rows = await database.Attendances.AsNoTracking()
            .Where(attendance => ids.Contains(attendance.MemberId))
            .Join(database.Rounds.AsNoTracking(), attendance => attendance.RoundId, round => round.Id, (attendance, round) => new { attendance, round })
            .OrderBy(pair => pair.round.LocalDate).ThenBy(pair => pair.round.LocalTime).ThenBy(pair => pair.round.Id)
            .Select(pair => new
            {
                pair.round.Id,
                pair.round.GroupId,
                pair.attendance.MemberId,
                pair.round.LocalDate,
                pair.round.LocalTime,
                pair.round.TimeZone,
                pair.attendance.Status,
                pair.attendance.Source,
                pair.attendance.RespondedAt,
                pair.attendance.PromotedAt,
            })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return [.. rows.Select(row => new AttendanceExportEntry(
            row.Id,
            row.GroupId,
            row.MemberId,
            row.LocalDate,
            row.LocalTime,
            row.TimeZone,
            EnumColumns.Parse(ColumnValues.AttendanceStatuses, row.Status),
            EnumColumns.Parse(ColumnValues.AttendanceSources, row.Source),
            row.RespondedAt,
            row.PromotedAt))];
    }
}
