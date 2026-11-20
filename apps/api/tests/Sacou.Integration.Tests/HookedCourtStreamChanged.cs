using Sacou.Modules.Matches.Contracts;

namespace Sacou.Integration.Tests;

/// <summary>An <see cref="ICourtStreamChanged"/> of the tests only: it runs the hook, or fails, after a write that changed a finished match.</summary>
internal sealed class HookedCourtStreamChanged(Func<Func<Task>?> hook) : ICourtStreamChanged
{
    public async Task CourtStreamChangedAsync(Guid groupId, Guid roundId, Guid courtSessionId, CancellationToken cancellationToken)
    {
        if (hook() is { } before)
        {
            await before().ConfigureAwait(false);
        }
    }
}
