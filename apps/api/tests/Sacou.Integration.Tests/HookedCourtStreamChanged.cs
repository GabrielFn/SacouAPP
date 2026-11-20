using Sacou.Modules.Matches.Contracts;

namespace Sacou.Integration.Tests;

/// <summary>A pass-through <see cref="ICourtStreamChanged"/> that lets a test act, or fail, before the Stats hears of a write.</summary>
internal sealed class HookedCourtStreamChanged(ICourtStreamChanged inner, Func<Func<Task>?> hook) : ICourtStreamChanged
{
    public async Task CourtStreamChangedAsync(Guid groupId, Guid roundId, Guid courtSessionId, CancellationToken cancellationToken)
    {
        if (hook() is { } before)
        {
            await before().ConfigureAwait(false);
        }

        await inner.CourtStreamChangedAsync(groupId, roundId, courtSessionId, cancellationToken).ConfigureAwait(false);
    }
}
