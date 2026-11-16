using System.Security.Claims;
using Microsoft.Extensions.Logging;
using Sacou.Modules.Identity.Authentication;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Identity.Domain.Accounts;
using Sacou.Modules.Identity.Domain.Users;
using Sacou.Modules.Identity.Infrastructure;
using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.DeleteMyAccount;

/// <summary>
/// The account deletion in idempotent steps, with no transaction across modules (ADR 0056, D7): the recent login;
/// each module erases the person's links under its own locks, checking the blockers (<see cref="ErasureMode.Checked"/>);
/// the Identity writes the tombstone and deletes the user and the profile; a last sweep erases whatever joined in
/// between. A failure in the middle is cured by calling again: every step finds only what is left. No event (D8).
/// </summary>
internal sealed partial class DeleteMyAccountHandler(
    IUserStore users,
    IDeletedAccountStore deletedAccounts,
    IEnumerable<IAccountErasure> erasures,
    TimeProvider time,
    ILogger<DeleteMyAccountHandler> logger)
{
    public async Task<AccountDeletion> HandleAsync(ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(principal);
        var now = time.GetUtcNow();
        var authenticatedAt = LoginClaims.ReadAuthenticatedAt(principal);
        if (authenticatedAt is not { } signedInAt || !LoginRecency.IsRecent(signedInAt, now))
        {
            return AccountDeletion.Refused(AccountErrors.RecentLoginRequired);
        }

        var subject = AuthSubject.Create(principal.FindFirstValue(ClaimTypes.NameIdentifier));
        if (subject.IsFailure)
        {
            return AccountDeletion.Refused(CurrentUserErrors.NotRegistered);
        }

        // Deleted already, or never signed in: deleting again is a success, and the owner of the token learns nothing new.
        if (await users.FindIdAsync(subject.Value, cancellationToken).ConfigureAwait(false) is not { } user)
        {
            return AccountDeletion.Deleted;
        }

        var blocking = await EraseAsync(user, ErasureMode.Checked, cancellationToken).ConfigureAwait(false);
        if (blocking.Count > 0)
        {
            Blocked(logger, AccountErrors.DeletionBlocked.Code, blocking.Count);
            return AccountDeletion.Blocked(blocking);
        }

        await deletedAccounts.DeleteAsync(user, subject.Value, now, cancellationToken).ConfigureAwait(false);
        await EraseAsync(user, ErasureMode.Sweep, cancellationToken).ConfigureAwait(false);
        Deleted(logger);
        return AccountDeletion.Deleted;
    }

    private async Task<IReadOnlyList<Guid>> EraseAsync(UserId user, ErasureMode mode, CancellationToken cancellationToken)
    {
        var blocking = new List<Guid>();
        foreach (var erasure in erasures)
        {
            blocking.AddRange(await erasure.EraseAsync(user.Value, mode, cancellationToken).ConfigureAwait(false));
        }

        return [.. blocking.Order()];
    }

    /// <summary>No user, member or group id, no name (ADR 0056, D11).</summary>
    [LoggerMessage(Level = LogLevel.Information, Message = "Account deleted.")]
    private static partial void Deleted(ILogger logger);

    /// <summary>Only the code and how many groups block, never which (D11).</summary>
    [LoggerMessage(Level = LogLevel.Information, Message = "Account deletion refused: {Code}, {Groups} groups.")]
    private static partial void Blocked(ILogger logger, string code, int groups);
}

/// <summary>
/// What the deletion did: <see cref="Error"/> null means the account is gone (204); otherwise the refusal, with the
/// groups to hand over first when it is <see cref="AccountErrors.DeletionBlocked"/>.
/// </summary>
internal sealed record AccountDeletion(Error? Error, IReadOnlyList<Guid> BlockingGroupIds)
{
    public static readonly AccountDeletion Deleted = new(null, []);

    public static AccountDeletion Refused(Error error) => new(error, []);

    public static AccountDeletion Blocked(IReadOnlyList<Guid> groupIds) => new(AccountErrors.DeletionBlocked, groupIds);
}
