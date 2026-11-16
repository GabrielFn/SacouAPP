using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Identity.Contracts;
using ContractRole = Sacou.Modules.Groups.Contracts.GroupRole;
using ContractType = Sacou.Modules.Groups.Contracts.MemberType;
using DomainUserId = Sacou.Modules.Groups.Domain.Members.UserId;

namespace Sacou.Modules.Groups.AccountData;

/// <summary>
/// "Grupos e papéis" of screen 30a (E3.16, ADR 0056, D9): every membership of the person, in every status, oldest
/// first. The group's name only while the person is an active member: of a group they left or were removed from,
/// the name is the group's data, which they no longer see and which may have changed since. Never the admin's
/// note about the person (question 42) nor anything about another member.
/// </summary>
internal sealed class GroupsExportSection(IGroupStore store) : IAccountExportSection
{
    public string Name => AccountExportSections.Groups;

    public int Order => AccountExportSections.GroupsOrder;

    public async Task<object?> ExportAsync(Guid userId, CancellationToken cancellationToken)
    {
        var memberships = await store.ListMembershipsOfUserAsync(new DomainUserId(userId), cancellationToken).ConfigureAwait(false);
        return memberships.Select(ToEntry).ToList();
    }

    private static GroupExportEntry ToEntry(AccountMembership membership) => new(
        membership.GroupId.Value,
        membership.Member.IsActive ? membership.GroupName.Value : null,
        membership.Member.Id.Value,
        ContractValues.ToContract(membership.Member.Role),
        ContractValues.ToContract(membership.Member.Type),
        ToExport(membership.Member.Status),
        membership.Member.JoinedAt,
        membership.Member.LeftAt);

    private static ExportedMembershipStatus ToExport(MembershipStatus status) => status switch
    {
        MembershipStatus.Active => ExportedMembershipStatus.Active,
        MembershipStatus.Left => ExportedMembershipStatus.Left,
        MembershipStatus.Removed => ExportedMembershipStatus.Removed,
        _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Every status needs an exported twin."),
    };
}

/// <summary>One membership in the export. The role it has or had: a member who left keeps it, for the history.</summary>
internal sealed record GroupExportEntry(
    Guid GroupId,
    string? GroupName,
    Guid MemberId,
    ContractRole Role,
    ContractType MemberType,
    ExportedMembershipStatus Status,
    DateTimeOffset JoinedAt,
    DateTimeOffset? LeftAt);

/// <summary>The membership status as the export writes it, converted by hand so the domain enum stays free to change.</summary>
internal enum ExportedMembershipStatus
{
    Active,
    Left,
    Removed,
}
