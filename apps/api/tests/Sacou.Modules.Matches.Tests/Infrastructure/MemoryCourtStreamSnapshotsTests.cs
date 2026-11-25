using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;
using Sacou.Modules.Matches.Infrastructure;
using Sacou.Modules.Matches.Tests.CourtSessions.Writes;
using Xunit;

namespace Sacou.Modules.Matches.Tests.Infrastructure;

/// <summary>The snapshots kept in memory (ADR 0081): newer only, least recently used out, expiry, one build per stream, a busy gate.</summary>
public sealed class MemoryCourtStreamSnapshotsTests
{
    private static readonly Guid Stream = Guid.NewGuid();
    private static readonly Guid OtherStream = Guid.NewGuid();
    private static readonly Guid ThirdStream = Guid.NewGuid();

    /// <summary>Above the small builds of the default options: a build of this many events takes a turn of the big gate.</summary>
    private const int BigStream = 5_000;

    [Fact]
    public void AnOlderOrEqualVersion_IsIgnored()
    {
        using var snapshots = Snapshots(new BlockingSource());
        var newer = SnapshotOf(points: 3);

        snapshots.Publish(Stream, newer);
        snapshots.Publish(Stream, SnapshotOf(points: 1));
        snapshots.Publish(Stream, SnapshotOf(points: 3));

        Assert.Same(newer, snapshots.TryGet(Stream));
    }

    [Fact]
    public void AFullCache_DropsTheLeastRecentlyUsed_AndAlwaysTakesTheNewOne()
    {
        using var snapshots = Snapshots(new BlockingSource(), maxEvents: 13);
        snapshots.Publish(Stream, SnapshotOf(points: 5));
        snapshots.Publish(OtherStream, SnapshotOf(points: 5));

        _ = snapshots.TryGet(Stream);
        snapshots.Publish(ThirdStream, SnapshotOf(points: 5));

        Assert.NotNull(snapshots.TryGet(Stream));
        Assert.Null(snapshots.TryGet(OtherStream));
        Assert.NotNull(snapshots.TryGet(ThirdStream));
        Assert.Equal(12, snapshots.HeldEvents);
    }

    [Fact]
    public void ASnapshotUnusedForTheSlidingTime_IsGone()
    {
        var clock = new ManualClock();
        using var snapshots = Snapshots(new BlockingSource(), clock: clock);
        snapshots.Publish(Stream, SnapshotOf(points: 1));

        clock.Advance(TimeSpan.FromMinutes(new CourtStreamCacheOptions().SlidingExpirationMinutes));

        Assert.Null(snapshots.TryGet(Stream));
        Assert.Equal(0, snapshots.HeldEvents);
    }

    [Fact]
    public async Task TwoWritesOfAStreamWithNoSnapshot_BuildItOnce()
    {
        var source = new BlockingSource();
        using var snapshots = Snapshots(source);

        var first = snapshots.EnsureAsync(Stream, eventCount: 2, TestContext.Current.CancellationToken);
        var second = snapshots.EnsureAsync(Stream, eventCount: 2, TestContext.Current.CancellationToken);
        await source.Started.Task.WaitAsync(TestContext.Current.CancellationToken);
        source.Release.SetResult();

        Assert.Equal([SnapshotWarmth.Built, SnapshotWarmth.Built], (await Task.WhenAll(first, second)).Select(warm => warm.Warmth));
        Assert.Equal(1, source.Reads);
        Assert.Equal(SnapshotWarmth.Hit, (await snapshots.EnsureAsync(Stream, eventCount: 2, TestContext.Current.CancellationToken)).Warmth);
    }

    [Fact]
    public async Task ABuildWithNoTurn_IsBusy()
    {
        var source = new BlockingSource();
        using var snapshots = Snapshots(source, maxConcurrentBuilds: 1, buildWaitMilliseconds: 1);
        var holding = snapshots.EnsureAsync(Stream, eventCount: BigStream, TestContext.Current.CancellationToken);
        await source.Started.Task.WaitAsync(TestContext.Current.CancellationToken);

        var refused = await snapshots.EnsureAsync(OtherStream, eventCount: BigStream, TestContext.Current.CancellationToken);
        source.Release.SetResult();

        Assert.Equal(WarmSnapshot.Busy, refused);
        Assert.Equal(SnapshotWarmth.Built, (await holding).Warmth);
        Assert.Null(snapshots.TryGet(OtherStream));
    }

    /// <summary>The handed-over snapshot is the one built or kept: a write evicted in between still has it (condition 1 of the review of Part 1).</summary>
    [Fact]
    public async Task TheWarmSnapshot_IsTheSnapshotItself_EvenIfEvictedAfter()
    {
        var source = new BlockingSource();
        source.Release.SetResult();
        using var snapshots = Snapshots(source);

        var built = await snapshots.EnsureAsync(Stream, eventCount: 2, TestContext.Current.CancellationToken);
        snapshots.Evict(Stream);

        Assert.NotNull(built.Snapshot);
        Assert.Equal(2, built.Snapshot.Version);
        Assert.Null(snapshots.TryGet(Stream));
    }

    /// <summary>
    /// Condition 5 of the review of Part 1: three big streams at once with two turns: exactly two reads run, never
    /// more at the same time, and the third is busy without reading anything.
    /// </summary>
    [Fact]
    public async Task BigBuilds_RunAtMostTwoAtOnce_AndTheThirdIsBusy()
    {
        var source = new BlockingSource();
        using var snapshots = Snapshots(source, maxConcurrentBuilds: 2, buildWaitMilliseconds: 50);
        var first = snapshots.EnsureAsync(Stream, eventCount: BigStream, TestContext.Current.CancellationToken);
        var second = snapshots.EnsureAsync(OtherStream, eventCount: BigStream, TestContext.Current.CancellationToken);
        await source.WaitForReadsAsync(2);

        var third = await snapshots.EnsureAsync(ThirdStream, eventCount: BigStream, TestContext.Current.CancellationToken);
        source.Release.SetResult();

        Assert.Equal(WarmSnapshot.Busy, third);
        Assert.Equal([SnapshotWarmth.Built, SnapshotWarmth.Built], (await Task.WhenAll(first, second)).Select(warm => warm.Warmth));
        Assert.Equal(2, source.Reads);
        Assert.Equal(2, source.MostAtOnce);
    }

    /// <summary>
    /// Condition 2 of the review of Part 1: full streams built in turn empty the cache and hold every big turn, and a
    /// small stream of a legitimate group is still built, on its own gate, never answered busy.
    /// </summary>
    [Fact]
    public async Task FullStreamsHoldingEveryBigTurn_NeverKeepASmallStreamOut()
    {
        const int SmallEvents = 3;
        var source = new BlockingSource(free: [Stream]);
        using var snapshots = Snapshots(source, maxEvents: 20, maxConcurrentBuilds: 2, buildWaitMilliseconds: 50, smallStreamEvents: 10);
        snapshots.Publish(Stream, SnapshotOf(points: SmallEvents - 1));
        foreach (var _ in Enumerable.Range(0, 4))
        {
            snapshots.Publish(Guid.NewGuid(), SnapshotOf(points: 9));
        }

        Assert.Null(snapshots.TryGet(Stream));
        var holding = new[] { OtherStream, ThirdStream }
            .Select(stream => snapshots.EnsureAsync(stream, eventCount: BigStream, TestContext.Current.CancellationToken))
            .ToList();
        await source.WaitForReadsAsync(2);

        var small = await snapshots.EnsureAsync(Stream, eventCount: SmallEvents, TestContext.Current.CancellationToken);
        var anotherBig = await snapshots.EnsureAsync(Guid.NewGuid(), eventCount: BigStream, TestContext.Current.CancellationToken);
        source.Release.SetResult();
        await Task.WhenAll(holding);

        Assert.Equal(SnapshotWarmth.Built, small.Warmth);
        Assert.Equal(WarmSnapshot.Busy, anotherBig);
    }

    [Fact]
    public void TheSizeMustHoldAFullStream()
    {
        var validator = new CourtStreamCacheOptionsValidator();

        Assert.True(validator.Validate(null, new CourtStreamCacheOptions()).Succeeded);
        Assert.True(validator.Validate(null, new CourtStreamCacheOptions { MaxEvents = CourtStreamLimits.MaxStreamEvents - 1 }).Failed);
        Assert.True(validator.Validate(null, new CourtStreamCacheOptions { MaxConcurrentBuilds = 0 }).Failed);
        Assert.True(validator.Validate(null, new CourtStreamCacheOptions { MaxConcurrentSmallBuilds = 0 }).Failed);
        Assert.True(validator.Validate(null, new CourtStreamCacheOptions { SmallStreamEvents = CourtStreamLimits.MaxEventsPerRequest - 1 }).Failed);
    }

    private static MemoryCourtStreamSnapshots Snapshots(
        BlockingSource source,
        int maxEvents = 60_000,
        int maxConcurrentBuilds = 2,
        int buildWaitMilliseconds = 2_000,
        int smallStreamEvents = 2_000,
        TimeProvider? clock = null)
    {
        var services = new ServiceCollection().AddScoped<ICourtSnapshotSource>(_ => source).BuildServiceProvider();
        var options = Options.Create(new CourtStreamCacheOptions
        {
            MaxEvents = maxEvents,
            MaxConcurrentBuilds = maxConcurrentBuilds,
            SmallStreamEvents = smallStreamEvents,
            BuildWaitMilliseconds = buildWaitMilliseconds,
        });
        return new MemoryCourtStreamSnapshots(services.GetRequiredService<IServiceScopeFactory>(), clock ?? TimeProvider.System, options);
    }

    /// <summary>A start and <paramref name="points"/> points: one more event than points.</summary>
    private static StreamSnapshot SnapshotOf(int points)
    {
        var events = CourtWriteFixture.Events(
            1,
            [(ScoreEventTypes.MatchStarted, CourtWriteFixture.MatchStarted()), .. Enumerable.Repeat((ScoreEventTypes.PointScored, CourtWriteFixture.Point("a")), points)]);
        return StreamSnapshot.Empty.Advance(CourtWriteFixture.Court, events);
    }

    /// <summary>A source whose read waits for the test (but for the <c>free</c> streams), counting the reads and the most at once.</summary>
    private sealed class BlockingSource(IReadOnlyCollection<Guid>? free = null) : ICourtSnapshotSource
    {
        private readonly System.Threading.Channels.Channel<Guid> _starts = System.Threading.Channels.Channel.CreateUnbounded<Guid>();
        private int _reads;
        private int _running;
        private int _mostAtOnce;

        public TaskCompletionSource Started { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public int Reads => Volatile.Read(ref _reads);

        public int MostAtOnce => Volatile.Read(ref _mostAtOnce);

        public async Task WaitForReadsAsync(int count)
        {
            for (var read = 0; read < count; read++)
            {
                _ = await _starts.Reader.ReadAsync(TestContext.Current.CancellationToken);
            }
        }

        public async Task<ReadSnapshot> ReadAsync(Guid courtSessionId, StreamSnapshot? from, CancellationToken cancellationToken)
        {
            _ = Interlocked.Increment(ref _reads);
            var running = Interlocked.Increment(ref _running);
            InterlockedMax(ref _mostAtOnce, running);
            Started.TrySetResult();
            _ = _starts.Writer.TryWrite(courtSessionId);
            if (free?.Contains(courtSessionId) != true)
            {
                await Release.Task.ConfigureAwait(false);
            }

            _ = Interlocked.Decrement(ref _running);
            return new ReadSnapshot(SnapshotOf(points: 1), SnapshotUse.Built);
        }

        public Task<ReadSnapshot?> AdvanceAsync(Guid courtSessionId, StreamSnapshot from, CancellationToken cancellationToken) =>
            Task.FromResult<ReadSnapshot?>(null);

        private static void InterlockedMax(ref int target, int value)
        {
            var seen = Volatile.Read(ref target);
            while (value > seen)
            {
                var previous = Interlocked.CompareExchange(ref target, value, seen);
                if (previous == seen)
                {
                    return;
                }

                seen = previous;
            }
        }
    }

    private sealed class ManualClock : TimeProvider
    {
        private DateTimeOffset _now = DateTimeOffset.UnixEpoch;

        public override DateTimeOffset GetUtcNow() => _now;

        public void Advance(TimeSpan by) => _now += by;
    }
}
