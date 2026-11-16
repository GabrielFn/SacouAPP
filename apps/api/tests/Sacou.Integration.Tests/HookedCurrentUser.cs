using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Results;

namespace Sacou.Integration.Tests;

/// <summary>
/// A pass-through <see cref="ICurrentUser"/> that runs a one-shot hook right after the user is resolved, so a test can
/// act between the resolution and the store's transaction (the window of ADR 0056, D7).
/// </summary>
internal sealed class HookedCurrentUser(ICurrentUser inner, Func<Func<Task>?> takeHook) : ICurrentUser
{
    public async Task<Result<CurrentUser>> GetAsync(CancellationToken cancellationToken)
    {
        var user = await inner.GetAsync(cancellationToken).ConfigureAwait(false);
        if (takeHook() is { } after)
        {
            await after().ConfigureAwait(false);
        }

        return user;
    }
}
