using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Invites;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>The invite reads, the acceptance and the way in by a round link (E3.12). Every lookup by token goes by its hash, never by the token.</summary>
internal sealed partial class PostgresGroupStore
{
    public async Task<InviteAttempt> AcceptInviteAsync(
        InviteTokenHash tokenHash,
        UserId person,
        Func<CancellationToken, Task<Result>> stillRegistered,
        Func<Group, InviteId, int, Result<GroupChange>> accept,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(tokenHash);
        ArgumentNullException.ThrowIfNull(stillRegistered);
        ArgumentNullException.ThrowIfNull(accept);
        var transaction = await database.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            var found = await FindInviteKeyAsync(tokenHash, cancellationToken).ConfigureAwait(false);
            if (found is null)
            {
                return new InviteAttempt(null, Result.Failure<GroupChange>(GroupErrors.InviteInvalid));
            }

            var (invite, group) = found.Value;
            var changed = await JoinUnderLockAsync(
                group, person, stillRegistered, (locked, activeGroups) => accept(locked, invite, activeGroups), cancellationToken)
                .ConfigureAwait(false);
            if (changed.IsSuccess)
            {
                await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            }

            return new InviteAttempt(invite, changed);
        }
    }

    public async Task<Result<GroupChange>> JoinAsync(
        GroupId group,
        UserId person,
        Func<CancellationToken, Task<Result>> stillRegistered,
        Func<Group, int, Result<GroupChange>> join,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(stillRegistered);
        ArgumentNullException.ThrowIfNull(join);
        var transaction = await database.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            var changed = await JoinUnderLockAsync(group, person, stillRegistered, join, cancellationToken).ConfigureAwait(false);
            if (changed.IsSuccess)
            {
                await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            }

            return changed;
        }
    }

    /// <summary>Inside the caller's transaction: the group lock, the person lock, the account check, the person's groups, the rule.</summary>
    private Task<Result<GroupChange>> JoinUnderLockAsync(
        GroupId group,
        UserId person,
        Func<CancellationToken, Task<Result>> stillRegistered,
        Func<Group, int, Result<GroupChange>> join,
        CancellationToken cancellationToken) =>
        ChangeUnderLockAsync(
            group,
            async locked =>
            {
                await LockPersonAsync(person, cancellationToken).ConfigureAwait(false);
                var registered = await stillRegistered(cancellationToken).ConfigureAwait(false);
                if (registered.IsFailure)
                {
                    return Result.Failure<GroupChange>(registered.Error);
                }

                var activeGroups = await CountActiveGroupsAsync(person, cancellationToken).ConfigureAwait(false);
                return join(locked, activeGroups);
            },
            cancellationToken);

    public async Task<IReadOnlyList<GroupInvite>> ListValidInvitesAsync(GroupId group, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var rows = await database.Invites.AsNoTracking()
            .Where(invite => invite.GroupId == group.Value && invite.RevokedAt == null)
            .OrderBy(invite => invite.CreatedAt).ThenBy(invite => invite.Id)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return [.. rows.Select(RowMapping.ToInvite).Where(invite => invite.IsValidAt(now))];
    }

    public async Task<InvitePreview?> FindInvitePreviewAsync(InviteTokenHash tokenHash, UserId person, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(tokenHash);
        var hash = tokenHash.Bytes.ToArray();
        var active = ColumnValues.ActiveStatus;
        var found = await database.Invites.AsNoTracking()
            .Where(invite => invite.TokenHash == hash)
            .Join(database.Groups.AsNoTracking(), invite => invite.GroupId, group => group.Id, (invite, group) => new
            {
                Invite = invite,
                group.Name,
                Active = database.Members.Count(member => member.GroupId == group.Id && member.Status == active),
                Mine = database.Members.Any(member => member.GroupId == group.Id && member.UserId == person.Value && member.Status == active),
            })
            .SingleOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        return found is null
            ? null
            : new InvitePreview(RowMapping.ToInvite(found.Invite), RowMapping.ToName(found.Name), found.Active, found.Mine);
    }

    /// <summary>Which invite, and of which group: both never change, so reading them before the group lock is safe.</summary>
    private async Task<(InviteId Invite, GroupId Group)?> FindInviteKeyAsync(InviteTokenHash tokenHash, CancellationToken cancellationToken)
    {
        var hash = tokenHash.Bytes.ToArray();
        var found = await database.Invites.AsNoTracking()
            .Where(invite => invite.TokenHash == hash)
            .Select(invite => new { invite.Id, invite.GroupId })
            .SingleOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        return found is null ? null : (new InviteId(found.Id), new GroupId(found.GroupId));
    }
}
