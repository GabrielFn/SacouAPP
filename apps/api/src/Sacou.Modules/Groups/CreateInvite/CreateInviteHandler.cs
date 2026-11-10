using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Domain.Invites;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Groups.Infrastructure.InviteTokens;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.CreateInvite;

/// <summary>
/// A new link: the token comes from the injected generator, only its hash goes to the aggregate, and the
/// invite is created under the group lock, where the caller's role and the ceiling of open invites are judged.
/// </summary>
internal sealed class CreateInviteHandler(IGroupStore store, IInviteTokenGenerator tokens, TimeProvider time)
{
    public async Task<Result<CreateInviteResponse>> HandleAsync(GroupAccess access, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(access);
        var now = time.GetUtcNow();
        var token = tokens.NewToken();
        var id = InviteId.New(now);
        var hash = InviteTokenHasher.Hash(token);
        var created = await store.ExecuteInGroupLockAsync(
            access.GroupId, group => group.CreateInvite(access.Member.Id, id, hash, now), cancellationToken).ConfigureAwait(false);
        return created.Match(
            _ => Result.Success(new CreateInviteResponse(id.Value, token, InviteRules.ExpiresAt(now))),
            Result.Failure<CreateInviteResponse>);
    }
}

/// <summary>The only response that ever carries the token: it is not stored, so it cannot be shown again.</summary>
internal sealed record CreateInviteResponse(Guid InviteId, string Token, DateTimeOffset? ExpiresAt)
{
    /// <summary>Never print the token, even by accident in a debugger or a log of the response.</summary>
    public override string ToString() => nameof(CreateInviteResponse);
}
