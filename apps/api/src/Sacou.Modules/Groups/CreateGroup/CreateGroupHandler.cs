using Sacou.Modules.Groups.Domain;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.CreateGroup;

/// <summary>Registered user first, then the name, then the per-person ceiling, checked atomically by the store.</summary>
internal sealed class CreateGroupHandler(ICurrentUser currentUser, IGroupStore store, TimeProvider time)
{
    public async Task<Result<CreateGroupResponse>> HandleAsync(string? name, CancellationToken cancellationToken)
    {
        var user = await currentUser.GetAsync(cancellationToken).ConfigureAwait(false);
        if (user.IsFailure)
        {
            return Result.Failure<CreateGroupResponse>(user.Error);
        }

        var groupName = GroupName.Create(name);
        if (groupName.IsFailure)
        {
            return Result.Failure<CreateGroupResponse>(groupName.Error);
        }

        var creator = new UserId(user.Value.UserId);
        var group = Group.Create(groupName.Value, creator, time.GetUtcNow());
        var stored = await store.CreateAsync(group, creator, GroupLimits.CanJoinAnotherGroup, cancellationToken).ConfigureAwait(false);
        return stored.Match(
            () => Result.Success(new CreateGroupResponse(group.Id.Value, group.Members[0].Id.Value)),
            Result.Failure<CreateGroupResponse>);
    }
}
