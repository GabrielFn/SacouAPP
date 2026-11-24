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

        Assert.Equal([SnapshotWarmth.Built, SnapshotWarmth.Built], await Task.WhenAll(first, second));
        Assert.Equal(1, source.Reads);
        Assert.Equal(SnapshotWarmth.Hit, await snapshots.EnsureAsync(Stream, eventCount: 2, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task ABuildWithNoTurn_IsBusy()
    {
        var source = new BlockingSource();
        using var snapshots = Snapshots(source, maxConcurrentBuilds: 1, buildWaitMilliseconds: 1);
        var holding = snapshots.EnsureAsync(Stream, eventCount: 2, TestContext.Current.CancellationToken);
        await source.Started.Task.WaitAsync(TestContext.Current.CancellationToken);

        var refused = await snapshots.EnsureAsync(OtherStream, eventCount: 2, TestContext.Current.CancellationToken);
        source.Release.SetResult();

        Assert.Equal(SnapshotWarmth.Busy, refused);
        Assert.Equal(SnapshotWarmth.Built, await holding);
        Assert.Null(snapshots.TryGet(OtherStream));
    }

    [Fact]
    public void TheSizeMustHoldAFullStream()
    {
        var validator = new CourtStreamCacheOptionsValidator();

        Assert.True(validator.Validate(null, new CourtStreamCacheOptions()).Succeeded);
        Assert.True(validator.Validate(null, new CourtStreamCacheOptions { MaxEvents = CourtStreamLimits.MaxStreamEvents - 1 }).Failed);
        Assert.True(validator.Validate(null, new CourtStreamCacheOptions { MaxConcurrentBuilds = 0 }).Failed);
    }

    private static MemoryCourtStreamSnapshots Snapshots(
        BlockingSource source, int maxEvents = 60_000, int maxConcurrentBuilds = 2, int buildWaitMilliseconds = 2_000, TimeProvider? clock = null)
    {
        var services = new ServiceCollection().AddScoped<ICourtSnapshotSource>(_ => source).BuildServiceProvider();
        var options = Options.Create(new CourtStreamCacheOptions
        {
            MaxEvents = maxEvents,
            MaxConcurrentBuilds = maxConcurrentBuilds,
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

    /// <summary>A source whose read waits for the test, counting the reads.</summary>
    private sealed class BlockingSource : ICourtSnapshotSource
    {
        private int _reads;

        public TaskCompletionSource Started { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public int Reads => Volatile.Read(ref _reads);

        public async Task<ReadSnapshot> ReadAsync(Guid courtSessionId, StreamSnapshot? from, CancellationToken cancellationToken)
        {
            _ = Interlocked.Increment(ref _reads);
            Started.TrySetResult();
            await Release.Task.ConfigureAwait(false);
            return new ReadSnapshot(SnapshotOf(points: 1), SnapshotUse.Built);
        }
    }

    private sealed class ManualClock : TimeProvider
    {
        private DateTimeOffset _now = DateTimeOffset.UnixEpoch;

        public override DateTimeOffset GetUtcNow() => _now;

        public void Advance(TimeSpan by) => _now += by;
    }
}
