using Sacou.Modules.Identity.Domain.Accounts;
using Sacou.Modules.Identity.Domain.Users;
using Sacou.Modules.Identity.Infrastructure;
using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.SignIn;

internal sealed record SignInOutcome(UserId UserId, bool Created);

/// <summary>
/// First sign-in creates the user; later ones find it. Find, then insert, then find again if a
/// concurrent sign-in won: only the one that inserted reports <see cref="SignInOutcome.Created"/> (ADR 0037, D6).
/// The insert refuses a deleted login (ADR 0056, D5), so a login that is neither found nor created is checked
/// against the tombstones: <see cref="AccountErrors.AccountDeleted"/>, and the app deletes the Firebase account again.
/// </summary>
internal sealed class SignInHandler(IUserStore users, IDeletedAccountStore deletedAccounts, TimeProvider time)
{
    public async Task<Result<SignInOutcome>> HandleAsync(AuthSubject subject, CancellationToken cancellationToken)
    {
        if (await users.FindIdAsync(subject, cancellationToken).ConfigureAwait(false) is { } existing)
        {
            return Result.Success(new SignInOutcome(existing, Created: false));
        }

        var user = User.Create(subject, time.GetUtcNow());
        if (await users.TryCreateAsync(user, cancellationToken).ConfigureAwait(false))
        {
            return Result.Success(new SignInOutcome(user.Id, Created: true));
        }

        if (await users.FindIdAsync(subject, cancellationToken).ConfigureAwait(false) is { } winner)
        {
            return Result.Success(new SignInOutcome(winner, Created: false));
        }

        return await deletedAccounts.IsDeletedAsync(subject, cancellationToken).ConfigureAwait(false)
            ? Result.Failure<SignInOutcome>(AccountErrors.AccountDeleted)
            : throw new InvalidOperationException("The insert conflicted, but no user has that subject.");
    }
}
