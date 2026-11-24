using Microsoft.Extensions.Caching.Memory;
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
    /// gets no turn in time answers <see cref="SnapshotWarmth.Busy"/>.
    /// </summary>
    Task<SnapshotWarmth> EnsureAsync(Guid courtSessionId, int eventCount, CancellationToken cancellationToken);
}

internal sealed class MemoryCourtStreamSnapshots : ICourtStreamSnapshots, IDisposable
{
    private const int SmallestSize = 1;

    private readonly MemoryCache _cache;
    private readonly IServiceScopeFactory _scopes;
    private readonly CourtStreamCacheOptions _options;
    private readonly SemaphoreSlim _builds;
    private readonly Lock _sync = new();
    private readonly Dictionary<Guid, Task<StreamSnapshot?>> _building = [];

    public MemoryCourtStreamSnapshots(IServiceScopeFactory scopes, IOptions<CourtStreamCacheOptions> options)
    {
        ArgumentNullException.ThrowIfNull(scopes);
        ArgumentNullException.ThrowIfNull(options);
        _scopes = scopes;
        _options = options.Value;
        _cache = new MemoryCache(new MemoryCacheOptions { SizeLimit = _options.MaxEvents });
        _builds = new SemaphoreSlim(_options.MaxConcurrentBuilds, _options.MaxConcurrentBuilds);
    }

    public StreamSnapshot? TryGet(Guid courtSessionId) => _cache.TryGetValue(courtSessionId, out StreamSnapshot? snapshot) ? snapshot : null;

    public void Publish(Guid courtSessionId, StreamSnapshot snapshot)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        lock (_sync)
        {
            if (TryGet(courtSessionId) is { } kept && kept.Version >= snapshot.Version)
            {
                return;
            }

            _ = _cache.Set(courtSessionId, snapshot, new MemoryCacheEntryOptions
            {
                Size = Math.Max(SmallestSize, snapshot.Version),
                SlidingExpiration = TimeSpan.FromMinutes(_options.SlidingExpirationMinutes),
                AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(_options.AbsoluteExpirationHours),
            });
        }
    }

    public void Evict(Guid courtSessionId)
    {
        lock (_sync)
        {
            _cache.Remove(courtSessionId);
        }
    }

    public async Task<SnapshotWarmth> EnsureAsync(Guid courtSessionId, int eventCount, CancellationToken cancellationToken)
    {
        if (TryGet(courtSessionId) is { } kept && kept.Version >= eventCount)
        {
            return SnapshotWarmth.Hit;
        }

        Task<StreamSnapshot?> build;
        lock (_sync)
        {
            if (!_building.TryGetValue(courtSessionId, out var running))
            {
                // On the thread pool, so its end, which forgets it under the same lock, always comes after this line.
                running = Task.Run(() => BuildAsync(courtSessionId), CancellationToken.None);
                _building[courtSessionId] = running;
            }

            build = running;
        }

        var built = await build.WaitAsync(cancellationToken).ConfigureAwait(false);
        return built is null ? SnapshotWarmth.Busy : SnapshotWarmth.Built;
    }

    /// <summary>
    /// In a scope of its own and with no token of a request: the requests that wait for it may go away, the build
    /// does not. A stream changed outside the API is thrown away and built again by the reader.
    /// </summary>
    private async Task<StreamSnapshot?> BuildAsync(Guid courtSessionId)
    {
        try
        {
            if (!await _builds.WaitAsync(_options.BuildWaitMilliseconds).ConfigureAwait(false))
            {
                return null;
            }

            try
            {
                var scope = _scopes.CreateAsyncScope();
                await using (scope.ConfigureAwait(false))
                {
                    var reader = scope.ServiceProvider.GetRequiredService<ICourtSnapshotSource>();
                    var read = await reader.ReadAsync(courtSessionId, TryGet(courtSessionId), CancellationToken.None).ConfigureAwait(false);
                    Keep(courtSessionId, read);
                    return read.Snapshot;
                }
            }
            finally
            {
                _builds.Release();
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
        if (read.Use == SnapshotUse.Built)
        {
            Evict(courtSessionId);
        }

        Publish(courtSessionId, read.Snapshot);
    }

    public void Dispose()
    {
        _cache.Dispose();
        _builds.Dispose();
    }
}
