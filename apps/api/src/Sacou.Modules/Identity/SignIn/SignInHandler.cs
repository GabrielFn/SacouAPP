using Sacou.Modules.Identity.Domain.Users;
using Sacou.Modules.Identity.Infrastructure;

namespace Sacou.Modules.Identity.SignIn;

internal sealed record SignInOutcome(UserId UserId, bool Created);

/// <summary>
/// First sign-in creates the user; later ones find it. Find, then insert, then find again if a
/// concurrent sign-in won: only the one that inserted reports <see cref="SignInOutcome.Created"/> (ADR 0037, D6).
/// </summary>
internal sealed class SignInHandler(IUserStore users, TimeProvider time)
{
    public async Task<SignInOutcome> HandleAsync(AuthSubject subject, CancellationToken cancellationToken)
    {
        if (await users.FindIdAsync(subject, cancellationToken).ConfigureAwait(false) is { } existing)
        {
            return new SignInOutcome(existing, Created: false);
        }

        var user = User.Create(subject, time.GetUtcNow());
        if (await users.TryCreateAsync(user, cancellationToken).ConfigureAwait(false))
        {
            return new SignInOutcome(user.Id, Created: true);
        }

        var winner = await users.FindIdAsync(subject, cancellationToken).ConfigureAwait(false)
            ?? throw new InvalidOperationException("The insert conflicted, but no user has that subject.");
        return new SignInOutcome(winner, Created: false);
    }
}
