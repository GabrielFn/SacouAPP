namespace Sacou.Integration.Tests;

/// <summary>The real clock plus an offset a test can change, to stand "23 hours before the round" without waiting for it.</summary>
internal sealed class ShiftableClock : TimeProvider
{
    private long offsetTicks;

    public override DateTimeOffset GetUtcNow() => DateTimeOffset.UtcNow.AddTicks(Interlocked.Read(ref offsetTicks));

    /// <summary>From now on the API reads <paramref name="moment"/> as the present (it keeps ticking from there).</summary>
    public void SetNow(DateTimeOffset moment) =>
        Interlocked.Exchange(ref offsetTicks, (moment - DateTimeOffset.UtcNow).Ticks);
}
