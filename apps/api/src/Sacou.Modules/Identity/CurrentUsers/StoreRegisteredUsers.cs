using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Identity.Domain.Users;
using Sacou.Modules.Identity.Infrastructure;
using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.CurrentUsers;

/// <summary>One read of <c>identity.users</c> by id, committed data only, with no lock of its own.</summary>
internal sealed class StoreRegisteredUsers(IUserStore users) : IRegisteredUsers
{
    public async Task<Result> ConfirmAsync(Guid userId, CancellationToken cancellationToken) =>
        await users.FindCreatedAtAsync(new UserId(userId), cancellationToken).ConfigureAwait(false) is null
            ? Result.Failure(CurrentUserErrors.NotRegistered)
            : Result.Success();
}
