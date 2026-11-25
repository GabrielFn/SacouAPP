using Microsoft.Extensions.Options;

namespace Sacou.Modules.Stats.Projections;

/// <summary>
/// One read rebuilding a group at a time (ADR 0081, Part 2): a semaphore per group id, in the memory of the process,
/// valid with one instance (<c>maxScale</c> 1, ADR 0068, like the rate limiter); with more, it becomes a
/// <c>pg_try_advisory_lock</c>. A group's semaphore lives only while somebody holds it or waits for it.
/// </summary>
internal sealed class GroupRebuildGate(IOptions<StatsRebuildOptions> options)
{
    private readonly Lock _sync = new();
    private readonly Dictionary<Guid, Turn> _turns = [];

    /// <summary>The group's turn, or null after waiting the configured time with the group still taken.</summary>
    public async Task<IDisposable?> TryEnterAsync(Guid groupId, CancellationToken cancellationToken)
    {
        Turn turn;
        lock (_sync)
        {
            if (!_turns.TryGetValue(groupId, out var found))
            {
                found = new Turn();
                _turns[groupId] = found;
            }

            found.Users++;
            turn = found;
        }

        var entered = false;
        try
        {
            entered = await turn.Semaphore.WaitAsync(options.Value.GroupWaitMilliseconds, cancellationToken).ConfigureAwait(false);
            return entered ? new Lease(this, groupId, turn) : null;
        }
        finally
        {
            if (!entered)
            {
                Leave(groupId, turn);
            }
        }
    }

    /// <summary>How many groups have a semaphore now: none once nobody holds or waits.</summary>
    public int GroupsInUse
    {
        get
        {
            lock (_sync)
            {
                return _turns.Count;
            }
        }
    }

    private void Leave(Guid groupId, Turn turn)
    {
        lock (_sync)
        {
            turn.Users--;
            if (turn.Users == 0)
            {
                _ = _turns.Remove(groupId);
                turn.Semaphore.Dispose();
            }
        }
    }

    /// <summary>Changed only under the gate's lock.</summary>
    private sealed class Turn
    {
        public SemaphoreSlim Semaphore { get; } = new(1, 1);

        public int Users { get; set; }
    }

    private sealed class Lease(GroupRebuildGate gate, Guid groupId, Turn turn) : IDisposable
    {
        private int _disposed;

        public void Dispose()
        {
            if (Interlocked.Exchange(ref _disposed, 1) == 0)
            {
                _ = turn.Semaphore.Release();
                gate.Leave(groupId, turn);
            }
        }
    }
}
