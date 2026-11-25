namespace Sacou.Api.Operations;

/// <summary>
/// The last answer, for <see cref="Lifetime"/>, in the memory of the one process (<c>maxScale</c> 1, ADR 0068, D2): a
/// click on "Atualizar" within it does not wake the Neon, and two requests at once count only once. The same answer for
/// every operator: it has no data of whoever asked.
/// </summary>
internal sealed class OpsMetricsCache(TimeProvider time) : IDisposable
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromSeconds(60);

    private readonly SemaphoreSlim gate = new(1, 1);

    private OpsMetricsResponse? current;

    /// <summary>The kept answer while it holds; otherwise <paramref name="load"/> at the current instant, kept for the next ones.</summary>
    public async Task<CachedAnswer> GetAsync(Func<DateTimeOffset, CancellationToken, Task<OpsMetricsResponse>> load, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(load);
        if (Fresh() is { } kept)
        {
            return new CachedAnswer(kept, Cached: true);
        }

        await gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (Fresh() is { } loadedMeanwhile)
            {
                return new CachedAnswer(loadedMeanwhile, Cached: true);
            }

            var loaded = await load(time.GetUtcNow(), cancellationToken).ConfigureAwait(false);
            Volatile.Write(ref current, loaded);
            return new CachedAnswer(loaded, Cached: false);
        }
        finally
        {
            gate.Release();
        }
    }

    public void Dispose() => gate.Dispose();

    private OpsMetricsResponse? Fresh() =>
        Volatile.Read(ref current) is { } kept && time.GetUtcNow() < kept.CachedUntil ? kept : null;
}

internal sealed record CachedAnswer(OpsMetricsResponse Value, bool Cached);
