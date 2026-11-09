namespace Sacou.Tests.TestSupport;

/// <summary>A clock that moves only when the test says so.</summary>
internal sealed class FixedTimeProvider(DateTimeOffset start) : TimeProvider
{
    private long utcTicks = start.UtcTicks;

    public override DateTimeOffset GetUtcNow() => new(Interlocked.Read(ref utcTicks), TimeSpan.Zero);

    public void Advance(TimeSpan by) => Interlocked.Add(ref utcTicks, by.Ticks);

    /// <summary>The current second, without the fraction: Unix times in tokens are whole seconds.</summary>
    public static DateTimeOffset WholeSecondNow() =>
        DateTimeOffset.FromUnixTimeSeconds(DateTimeOffset.UtcNow.ToUnixTimeSeconds());
}
