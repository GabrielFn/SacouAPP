using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;

namespace Sacou.Modules.Matches.Infrastructure;

/// <summary>What <see cref="ICourtStreamSnapshots.EnsureAsync"/> found: a snapshot already there, one it built, or no turn to build.</summary>
internal enum SnapshotWarmth
{
    Hit,
    Built,
    Busy,
}

/// <summary>
/// What <see cref="ICourtStreamSnapshots.EnsureAsync"/> handed over: the snapshot itself, so the lock that follows works
/// on this one and never asks the cache again (one evicted in between is still the one the write uses). Null when busy.
/// </summary>
internal sealed record WarmSnapshot(SnapshotWarmth Warmth, StreamSnapshot? Snapshot)
{
    public static readonly WarmSnapshot Busy = new(SnapshotWarmth.Busy, Snapshot: null);

    public override string ToString() => $"{nameof(WarmSnapshot)}({Warmth})";
}

/// <summary>
/// The snapshots of the court streams in the memory of the process (ADR 0081), by stream id. Only content read from the
/// database or committed goes in; nothing goes to disk nor to a log. A singleton: with one instance (ADR 0068) every
/// request of a stream finds it, and with more each one checks its copy against the database anyway.
/// </summary>
internal interface ICourtStreamSnapshots
{
    StreamSnapshot? TryGet(Guid courtSessionId);

    /// <summary>Keeps the snapshot unless the one kept is as new or newer.</summary>
    void Publish(Guid courtSessionId, StreamSnapshot snapshot);

    void Evict(Guid courtSessionId);

    /// <summary>
    /// Outside any lock: a snapshot of at least <paramref name="eventCount"/> events, from the one kept or read from the
    /// database. One build per stream at a time, the others wait for it; a few builds at a time in all, and a build that
    /// gets no turn in time answers <see cref="SnapshotWarmth.Busy"/>. A build that reads fewer than
    /// <see cref="CourtStreamCacheOptions.SmallStreamEvents"/> events takes a turn of a gate of its own: full streams,
    /// built again and again, never keep the small ones out.
    /// </summary>
    Task<WarmSnapshot> EnsureAsync(Guid courtSessionId, int eventCount, CancellationToken cancellationToken);
}

/// <summary>
/// The snapshots by stream, measured in stored events: a new one always goes in, and the least recently used go out
/// until the total fits <see cref="CourtStreamCacheOptions.MaxEvents"/>. Not <c>MemoryCache</c>, which refuses an entry
/// that does not fit instead of making room, so a full cache would keep no new stream. A snapshot unused for the
/// sliding time, or kept for the absolute one, is gone.
/// </summary>
internal sealed class MemoryCourtStreamSnapshots : ICourtStreamSnapshots, IDisposable
{
    private const int SmallestSize = 1;
    private const int NoVersion = 0;

    private readonly IServiceScopeFactory _scopes;
    private readonly TimeProvider _time;
    private readonly CourtStreamCacheOptions _options;
    private readonly TimeSpan _sliding;
    private readonly TimeSpan _absolute;
    private readonly SemaphoreSlim _builds;
    private readonly SemaphoreSlim _smallBuilds;
    private readonly Lock _sync = new();
    private readonly Dictionary<Guid, Entry> _entries = [];
    private readonly Dictionary<Guid, Task<StreamSnapshot?>> _building = [];
    private long _heldEvents;

    public MemoryCourtStreamSnapshots(IServiceScopeFactory scopes, TimeProvider time, IOptions<CourtStreamCacheOptions> options)
    {
        ArgumentNullException.ThrowIfNull(scopes);
        ArgumentNullException.ThrowIfNull(time);
        ArgumentNullException.ThrowIfNull(options);
        _scopes = scopes;
        _time = time;
        _options = options.Value;
        _sliding = TimeSpan.FromMinutes(_options.SlidingExpirationMinutes);
        _absolute = TimeSpan.FromHours(_options.AbsoluteExpirationHours);
        _builds = new SemaphoreSlim(_options.MaxConcurrentBuilds, _options.MaxConcurrentBuilds);
        _smallBuilds = new SemaphoreSlim(_options.MaxConcurrentSmallBuilds, _options.MaxConcurrentSmallBuilds);
    }

    /// <summary>The stored events all kept snapshots hold together.</summary>
    public long HeldEvents
    {
        get
        {
            lock (_sync)
            {
                return _heldEvents;
            }
        }
    }

    public StreamSnapshot? TryGet(Guid courtSessionId)
    {
        lock (_sync)
        {
            var now = _time.GetUtcNow();
            if (!_entries.TryGetValue(courtSessionId, out var entry) || IsExpired(entry, now))
            {
                Remove(courtSessionId);
                return null;
            }

            _entries[courtSessionId] = entry with { LastUsed = now };
            return entry.Snapshot;
        }
    }

    public void Publish(Guid courtSessionId, StreamSnapshot snapshot)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        lock (_sync)
        {
            var now = _time.GetUtcNow();
            if (_entries.TryGetValue(courtSessionId, out var kept) && !IsExpired(kept, now) && kept.Snapshot.Version >= snapshot.Version)
            {
                return;
            }

            Remove(courtSessionId);
            _entries[courtSessionId] = new Entry(snapshot, Kept: now, LastUsed: now);
            _heldEvents += SizeOf(snapshot);
            MakeRoom(now);
        }
    }

    public void Evict(Guid courtSessionId)
    {
        lock (_sync)
        {
            Remove(courtSessionId);
        }
    }

    public async Task<WarmSnapshot> EnsureAsync(Guid courtSessionId, int eventCount, CancellationToken cancellationToken)
    {
        var kept = TryGet(courtSessionId);
        if (kept is not null && kept.Version >= eventCount)
        {
            return new WarmSnapshot(SnapshotWarmth.Hit, kept);
        }

        var gate = eventCount - (kept?.Version ?? NoVersion) < _options.SmallStreamEvents ? _smallBuilds : _builds;
        Task<StreamSnapshot?> build;
        lock (_sync)
        {
            if (!_building.TryGetValue(courtSessionId, out var running))
            {
                // On the thread pool, so its end, which forgets it under the same lock, always comes after this line.
                running = Task.Run(() => BuildAsync(courtSessionId, gate), CancellationToken.None);
                _building[courtSessionId] = running;
            }

            build = running;
        }

        var built = await build.WaitAsync(cancellationToken).ConfigureAwait(false);
        return built is null ? WarmSnapshot.Busy : new WarmSnapshot(SnapshotWarmth.Built, built);
    }

    /// <summary>
    /// In a scope of its own and with no token of a request: the requests that wait for it may go away, the build
    /// does not. A stream changed outside the API is thrown away and built again by the source.
    /// </summary>
    private async Task<StreamSnapshot?> BuildAsync(Guid courtSessionId, SemaphoreSlim gate)
    {
        try
        {
            if (!await gate.WaitAsync(_options.BuildWaitMilliseconds).ConfigureAwait(false))
            {
                return null;
            }

            try
            {
                var scope = _scopes.CreateAsyncScope();
                await using (scope.ConfigureAwait(false))
                {
                    var source = scope.ServiceProvider.GetRequiredService<ICourtSnapshotSource>();
                    var read = await source.ReadAsync(courtSessionId, TryGet(courtSessionId), CancellationToken.None).ConfigureAwait(false);
                    Keep(courtSessionId, read);
                    return read.Snapshot;
                }
            }
            finally
            {
                gate.Release();
            }
        }
        finally
        {
            lock (_sync)
            {
                _ = _building.Remove(courtSessionId);
            }
        }
    }

    /// <summary>A snapshot built from the whole stream replaces the one kept, which may be of a stream changed outside the API.</summary>
    private void Keep(Guid courtSessionId, ReadSnapshot read)
    {
        lock (_sync)
        {
            if (read.Use == SnapshotUse.Built)
            {
                Remove(courtSessionId);
            }

            Publish(courtSessionId, read.Snapshot);
        }
    }

    /// <summary>Under the lock: the expired first, then the least recently used, until the total fits.</summary>
    private void MakeRoom(DateTimeOffset now)
    {
        foreach (var expired in _entries.Where(pair => IsExpired(pair.Value, now)).Select(pair => pair.Key).ToList())
        {
            Remove(expired);
        }

        while (_heldEvents > _options.MaxEvents && _entries.Count > 0)
        {
            Remove(_entries.MinBy(pair => pair.Value.LastUsed).Key);
        }
    }

    /// <summary>Under the lock.</summary>
    private void Remove(Guid courtSessionId)
    {
        if (_entries.Remove(courtSessionId, out var entry))
        {
            _heldEvents -= SizeOf(entry.Snapshot);
        }
    }

    private bool IsExpired(Entry entry, DateTimeOffset now) => now - entry.LastUsed >= _sliding || now - entry.Kept >= _absolute;

    private static long SizeOf(StreamSnapshot snapshot) => Math.Max(SmallestSize, snapshot.Version);

    public void Dispose()
    {
        _builds.Dispose();
        _smallBuilds.Dispose();
    }

    private sealed record Entry(StreamSnapshot Snapshot, DateTimeOffset Kept, DateTimeOffset LastUsed);
}
