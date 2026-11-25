using Microsoft.Extensions.Logging;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Identity.Contracts;
using DomainUserId = Sacou.Modules.Groups.Domain.Members.UserId;

namespace Sacou.Modules.Groups.AccountData;

/// <summary>
/// The account deletion in the Groups (E3.16, ADR 0056, D1, D2 and D7): under the locks of every group of the person,
/// the deletion rule is judged again (<see cref="DeletionRules"/>; the preview of screen 30b may be stale), and then
/// the person becomes a former player in each group, the invites they made die and the levels about them go. After a
/// restore (<see cref="ErasureMode.AfterRestore"/>, E6.3), a group that loses its last admin gets the oldest active
/// member with an account as Admin (question 231); the groups with no one to promote come back.
/// </summary>
internal sealed partial class GroupsAccountErasure(IGroupStore store, TimeProvider time, ILogger<GroupsAccountErasure> logger) : IAccountErasure
{
    public async Task<IReadOnlyList<Guid>> EraseAsync(Guid userId, ErasureMode mode, CancellationToken cancellationToken)
    {
        var person = new DomainUserId(userId);
        var now = time.GetUtcNow();
        if (mode == ErasureMode.AfterRestore)
        {
            return await EraseAfterRestoreAsync(person, now, cancellationToken).ConfigureAwait(false);
        }

        var blocking = await store.EraseAccountAsync(
            person,
            group => mode == ErasureMode.Checked && group.ActiveMemberOf(person) is { } member && DeletionRules.IsDeletionBlocker(group, member.Id),
            group => group.EraseAccount(person, now),
            cancellationToken).ConfigureAwait(false);
        return [.. blocking.Select(group => group.Value)];
    }

    /// <summary>
    /// Sets, not lists: a pass of the store that finds a group joined meanwhile writes nothing and runs the erasure again
    /// on the same groups, so the same group may be judged twice.
    /// </summary>
    private async Task<IReadOnlyList<Guid>> EraseAfterRestoreAsync(DomainUserId person, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var promoted = new HashSet<GroupId>();
        var withoutAdmin = new HashSet<GroupId>();
        _ = await store.EraseAccountAsync(
            person,
            _ => false,
            group =>
            {
                var change = group.EraseAccountAfterRestore(person, now);
                if (group.LosesLastAdminWith(person))
                {
                    _ = change.Group.ActiveMembers.Any(member => member.IsActiveAdmin) ? promoted.Add(group.Id) : withoutAdmin.Add(group.Id);
                }

                return change;
            },
            cancellationToken).ConfigureAwait(false);
        ErasedAfterRestore(logger, promoted.Count, withoutAdmin.Count);
        return [.. withoutAdmin.Select(group => group.Value).Order()];
    }

    /// <summary>Only how many groups, never which (ADR 0056, D11).</summary>
    [LoggerMessage(Level = LogLevel.Information, Message = "Account erased after a restore: {Promoted} admins promoted, {WithoutAdmin} groups left without an admin.")]
    private static partial void ErasedAfterRestore(ILogger logger, int promoted, int withoutAdmin);
}
