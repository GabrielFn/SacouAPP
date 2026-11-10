using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Invites;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Domain.Settings;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Tests.Access;

internal sealed class FakeCurrentUser(Guid? userId) : ICurrentUser
{
    public Task<Result<CurrentUser>> GetAsync(CancellationToken cancellationToken) =>
        Task.FromResult(userId is { } id
            ? Result.Success(new CurrentUser(id))
            : Result.Failure<CurrentUser>(CurrentUserErrors.NotRegistered));
}

/// <summary>
/// The membership lookup the filter needs, and an in-memory aggregate (<see cref="Locked"/>) for the invite
/// handlers. Counts calls, so a refusal can prove it never asked.
/// </summary>
internal sealed class FakeGroupStore : IGroupStore
{
    private readonly Dictionary<(GroupId, UserId), GroupMember> members = [];

    public int Lookups { get; private set; }

    /// <summary>Every call on the invite side: a malformed token must leave it at zero.</summary>
    public int InviteCalls { get; private set; }

    /// <summary>The aggregate a write under the lock sees, and what it becomes after a successful change.</summary>
    public Group? Locked { get; set; }

    public int ActiveGroupsOfPerson { get; set; }

    public void Add(GroupId group, GroupMember member) => members[(group, member.UserId!.Value)] = member;

    public Task<GroupMember?> FindActiveMemberAsync(GroupId group, UserId user, CancellationToken cancellationToken)
    {
        Lookups++;
        return Task.FromResult(members.TryGetValue((group, user), out var member) && member.IsActive ? member : null);
    }

    public Task<Result> CreateAsync(
        Group group, UserId creator, Func<int, Result> admission, StoredSettings settings, CancellationToken cancellationToken) =>
        throw new NotSupportedException();

    public Task<IReadOnlyList<MemberGroup>> ListActiveGroupsAsync(UserId user, CancellationToken cancellationToken) =>
        throw new NotSupportedException();

    public Task<GroupOverview?> FindOverviewAsync(GroupId group, CancellationToken cancellationToken) =>
        throw new NotSupportedException();

    public Task<IReadOnlyList<GroupMember>> ListActiveMembersAsync(GroupId group, CancellationToken cancellationToken) =>
        throw new NotSupportedException();

    public Task<bool> RenameAsync(GroupId group, UserId renamer, GroupName name, CancellationToken cancellationToken) =>
        throw new NotSupportedException();

    public Task<Result<GroupChange>> ExecuteInGroupLockAsync(GroupId group, Func<Group, Result<GroupChange>> change, CancellationToken cancellationToken)
    {
        InviteCalls++;
        return Task.FromResult(Locked is null || Locked.Id != group ? Result.Failure<GroupChange>(GroupErrors.GroupNotFound) : Apply(change(Locked)));
    }

    public Task<InviteAttempt> AcceptInviteAsync(
        InviteTokenHash tokenHash, UserId person, Func<Group, InviteId, int, Result<GroupChange>> accept, CancellationToken cancellationToken)
    {
        InviteCalls++;
        var invite = Locked?.Invites.SingleOrDefault(candidate => candidate.TokenHash == tokenHash);
        return Task.FromResult(invite is null
            ? new InviteAttempt(null, Result.Failure<GroupChange>(GroupErrors.InviteInvalid))
            : new InviteAttempt(invite.Id, Apply(accept(Locked!, invite.Id, ActiveGroupsOfPerson))));
    }

    public Task<IReadOnlyList<GroupInvite>> ListValidInvitesAsync(GroupId group, DateTimeOffset now, CancellationToken cancellationToken) =>
        throw new NotSupportedException();

    public Task<InvitePreview?> FindInvitePreviewAsync(InviteTokenHash tokenHash, UserId person, CancellationToken cancellationToken)
    {
        InviteCalls++;
        var invite = Locked?.Invites.SingleOrDefault(candidate => candidate.TokenHash == tokenHash);
        return Task.FromResult(invite is null
            ? null
            : new InvitePreview(invite, Locked!.Name, Locked.ActiveMembers.Count(), Locked.ActiveMemberOf(person) is not null));
    }

    private Result<GroupChange> Apply(Result<GroupChange> changed)
    {
        if (changed.IsSuccess)
        {
            Locked = changed.Value.Group;
        }

        return changed;
    }
}
