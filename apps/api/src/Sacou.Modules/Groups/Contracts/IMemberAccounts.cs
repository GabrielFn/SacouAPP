using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Groups.Infrastructure;

namespace Sacou.Modules.Groups.Contracts;

/// <summary>
/// The account behind a member, for the Notifications only (ADR 0069, D4): a notification points to the member, and the
/// phones belong to the account. The user id answered never leaves the module that asked, nor reaches an event or a log.
/// </summary>
public interface IMemberAccounts
{
    /// <summary>The account of an active member; null for a guest without an account, a former member or a deleted account.</summary>
    Task<Guid?> FindUserOfActiveMemberAsync(Guid memberId, CancellationToken cancellationToken);
}

/// <summary>One indexed read by the member's primary key, no lock.</summary>
internal sealed class StoreMemberAccounts(GroupsDbContext database) : IMemberAccounts
{
    public Task<Guid?> FindUserOfActiveMemberAsync(Guid memberId, CancellationToken cancellationToken)
    {
        var active = ColumnValues.ActiveStatus;
        return database.Members.AsNoTracking()
            .Where(member => member.Id == memberId && member.Status == active && member.UserId != null)
            .Select(member => member.UserId)
            .SingleOrDefaultAsync(cancellationToken);
    }
}
