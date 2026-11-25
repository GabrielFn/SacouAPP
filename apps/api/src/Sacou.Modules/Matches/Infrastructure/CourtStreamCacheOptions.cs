using Microsoft.Extensions.Options;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;

namespace Sacou.Modules.Matches.Infrastructure;

/// <summary>
/// The in-memory snapshots of the court streams (ADR 0081), from <c>CourtStreamCache</c>. The size is in stored events,
/// the measure of a snapshot's memory: the default holds three streams at their ceiling of 20,000.
/// </summary>
internal sealed class CourtStreamCacheOptions
{
    public const string SectionName = "CourtStreamCache";

    private const int ThreeFullStreams = 60_000;
    private const int TwoBuilds = 2;
    private const int FourSmallBuilds = 4;
    private const int AboveARound = 2_000;
    private const int TwoSeconds = 2_000;
    private const int HalfAnHour = 30;
    private const int SixHours = 6;

    /// <summary>The stored events all snapshots hold together; the oldest unused go first.</summary>
    public int MaxEvents { get; set; } = ThreeFullStreams;

    /// <summary>How many builds of at least <see cref="SmallStreamEvents"/> events run at once, across all streams.</summary>
    public int MaxConcurrentBuilds { get; set; } = TwoBuilds;

    /// <summary>
    /// Below this many events to read, a build is small: it takes a turn of its own gate, never one of the big builds
    /// (ADR 0081, Part 2). A typical round has about 1,500 events. Also the most a write advances its snapshot under the
    /// lock: more than that is a 503 and the next try advances it outside.
    /// </summary>
    public int SmallStreamEvents { get; set; } = AboveARound;

    /// <summary>How many small builds run at once, across all streams.</summary>
    public int MaxConcurrentSmallBuilds { get; set; } = FourSmallBuilds;

    /// <summary>How long a build waits for its turn before the write is answered 503 <c>matches.court-busy</c>.</summary>
    public int BuildWaitMilliseconds { get; set; } = TwoSeconds;

    public int SlidingExpirationMinutes { get; set; } = HalfAnHour;

    public int AbsoluteExpirationHours { get; set; } = SixHours;
}

/// <summary>Every number above zero. Runs on start, through <c>ValidateOnStart</c>.</summary>
internal sealed class CourtStreamCacheOptionsValidator : IValidateOptions<CourtStreamCacheOptions>
{
    private const int Minimum = 1;

    public ValidateOptionsResult Validate(string? name, CourtStreamCacheOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        List<string> failures =
        [
            .. Failure(nameof(options.MaxEvents), options.MaxEvents, CourtStreamLimits.MaxStreamEvents),
            .. Failure(nameof(options.MaxConcurrentBuilds), options.MaxConcurrentBuilds),
            .. Failure(nameof(options.SmallStreamEvents), options.SmallStreamEvents, CourtStreamLimits.MaxEventsPerRequest),
            .. Failure(nameof(options.MaxConcurrentSmallBuilds), options.MaxConcurrentSmallBuilds),
            .. Failure(nameof(options.BuildWaitMilliseconds), options.BuildWaitMilliseconds),
            .. Failure(nameof(options.SlidingExpirationMinutes), options.SlidingExpirationMinutes),
            .. Failure(nameof(options.AbsoluteExpirationHours), options.AbsoluteExpirationHours),
        ];
        return failures.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(failures);
    }

    /// <summary>
    /// The size must hold one stream at its ceiling, or a full stream would never be kept; a small build must hold one
    /// request, or a write could never advance its snapshot under the lock.
    /// </summary>
    private static IEnumerable<string> Failure(string setting, int value, int minimum = Minimum) =>
        value < minimum ? [$"{CourtStreamCacheOptions.SectionName}:{setting} must be at least {minimum}."] : [];
}
