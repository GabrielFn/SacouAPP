using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Infrastructure;

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
        return await attendances.ListOfMembersAsync(members, cancellationToken).ConfigureAwait(false);
    }
}

/// <summary>One attendance in the export: the round it belongs to, the person's member id there, and the answer.</summary>
internal sealed record AttendanceExportEntry(
    Guid RoundId,
    Guid GroupId,
    Guid MemberId,
    DateOnly LocalDate,
    TimeOnly LocalTime,
    string TimeZone,
    AttendanceStatus Status,
    AttendanceSource Source,
    DateTimeOffset RespondedAt,
    DateTimeOffset? PromotedAt);
