using Sacou.Modules.Matches.Domain.CourtSessions.Writes;
using Sacou.Modules.Matches.Infrastructure;

namespace Sacou.Integration.Tests;

/// <summary>
/// The API's own snapshot cache, passed through, running the hook right after each warm-up and before the write takes
/// the stream's lock (ADR 0081, Part 2): a test evicts the snapshot, or changes the stream, at that exact moment.
/// </summary>
internal sealed class HookedCourtStreamSnapshots(ICourtStreamSnapshots inner, Func<Func<Guid, ICourtStreamSnapshots, Task>?> hook) : ICourtStreamSnapshots
{
    public StreamSnapshot? TryGet(Guid courtSessionId) => inner.TryGet(courtSessionId);

    public void Publish(Guid courtSessionId, StreamSnapshot snapshot) => inner.Publish(courtSessionId, snapshot);

    public void Evict(Guid courtSessionId) => inner.Evict(courtSessionId);

    public async Task<WarmSnapshot> EnsureAsync(Guid courtSessionId, int eventCount, CancellationToken cancellationToken)
    {
        var warm = await inner.EnsureAsync(courtSessionId, eventCount, cancellationToken).ConfigureAwait(false);
        if (hook() is { } after)
        {
            await after(courtSessionId, inner).ConfigureAwait(false);
        }

        return warm;
    }
}
