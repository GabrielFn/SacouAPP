using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Members;
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

/// <summary>Only the membership lookup the filter needs; counts calls so a refusal can prove it never asked.</summary>
internal sealed class FakeGroupStore : IGroupStore
{
    private readonly Dictionary<(GroupId, UserId), GroupMember> members = [];

    public int Lookups { get; private set; }

    public void Add(GroupId group, GroupMember member) => members[(group, member.UserId!.Value)] = member;

    public Task<GroupMember?> FindActiveMemberAsync(GroupId group, UserId user, CancellationToken cancellationToken)
    {
        Lookups++;
        return Task.FromResult(members.TryGetValue((group, user), out var member) && member.IsActive ? member : null);
    }

    public Task<Result> CreateAsync(Group group, UserId creator, Func<int, Result> admission, CancellationToken cancellationToken) =>
        throw new NotSupportedException();

    public Task<IReadOnlyList<MemberGroup>> ListActiveGroupsAsync(UserId user, CancellationToken cancellationToken) =>
        throw new NotSupportedException();

    public Task<GroupOverview?> FindOverviewAsync(GroupId group, CancellationToken cancellationToken) =>
        throw new NotSupportedException();

    public Task<IReadOnlyList<GroupMember>> ListActiveMembersAsync(GroupId group, CancellationToken cancellationToken) =>
        throw new NotSupportedException();

    public Task RenameAsync(GroupId group, GroupName name, CancellationToken cancellationToken) =>
        throw new NotSupportedException();
}
