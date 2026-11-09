using System.Collections.Frozen;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

namespace Sacou.Modules.Identity.Authentication;

/// <summary>
/// Caches the Google signing keys for the <c>Cache-Control: max-age</c> of the response, clamped to
/// 5 min..24 h. One fetch at a time; an unknown <c>kid</c> forces at most one fetch every 5 min. When a
/// fetch fails, the cached keys keep working until each certificate expires (ADR 0036).
/// </summary>
internal sealed partial class GoogleSigningKeySource(
    GoogleSigningKeyFetcher fetcher,
    TimeProvider time,
    ILogger<GoogleSigningKeySource> logger) : ISigningKeySource, IDisposable
{
    public static readonly TimeSpan MinCacheLifetime = TimeSpan.FromMinutes(5);
    public static readonly TimeSpan MaxCacheLifetime = TimeSpan.FromHours(24);
    public static readonly TimeSpan MinTimeBetweenFetches = TimeSpan.FromMinutes(5);

    /// <summary>Tick 0 (year 1): far enough back that the first fetch is always allowed, with no overflow.</summary>
    private const long NoAttempt = 0;

    private readonly SemaphoreSlim refreshLock = new(1, 1);

    // Replaced whole, never changed in place.
    private SigningKeySet? current;
    private long lastAttemptTicks = NoAttempt;
    private long attempts;

    public async Task<SigningKeyLookup> FindAsync(string keyId, CancellationToken cancellationToken)
    {
        var observedAttempts = Interlocked.Read(ref attempts);
        var snapshot = Volatile.Read(ref current);
        if (snapshot is null || NeedsFetch(snapshot, keyId, time.GetUtcNow()))
        {
            await RefreshAsync(observedAttempts, cancellationToken).ConfigureAwait(false);
            snapshot = Volatile.Read(ref current);
        }

        return snapshot?.Find(keyId, time.GetUtcNow()) ?? SigningKeyLookup.Unavailable;
    }

    public void Dispose() => refreshLock.Dispose();

    internal static TimeSpan CacheLifetime(TimeSpan? maxAge) =>
        maxAge is not { } age || age < MinCacheLifetime ? MinCacheLifetime
        : age > MaxCacheLifetime ? MaxCacheLifetime
        : age;

    private bool NeedsFetch(SigningKeySet snapshot, string keyId, DateTimeOffset now) =>
        (now >= snapshot.FreshUntil || !snapshot.Contains(keyId))
        && now.UtcTicks - Interlocked.Read(ref lastAttemptTicks) >= MinTimeBetweenFetches.Ticks;

    /// <summary>Whoever waited while another caller fetched reuses that attempt instead of fetching again.</summary>
    private async Task RefreshAsync(long observedAttempts, CancellationToken cancellationToken)
    {
        await refreshLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (Interlocked.Read(ref attempts) != observedAttempts)
            {
                return;
            }

            var fetched = await fetcher.FetchAsync().ConfigureAwait(false);
            var now = time.GetUtcNow();
            Interlocked.Exchange(ref lastAttemptTicks, now.UtcTicks);
            Interlocked.Increment(ref attempts);
            Store(fetched, now);
        }
        finally
        {
            refreshLock.Release();
        }
    }

    private void Store(FetchedSigningKeys? fetched, DateTimeOffset now)
    {
        if (fetched is not null)
        {
            Volatile.Write(ref current, new SigningKeySet(fetched.Keys, now + CacheLifetime(fetched.MaxAge)));
        }
        else if (Volatile.Read(ref current) is not null)
        {
            LogServingCachedKeys(logger);
        }
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Using the cached ID token signing keys until their certificates expire.")]
    private static partial void LogServingCachedKeys(ILogger logger);

    private sealed record SigningKeySet(FrozenDictionary<string, X509SecurityKey> Keys, DateTimeOffset FreshUntil)
    {
        public bool Contains(string keyId) => Keys.ContainsKey(keyId);

        public SigningKeyLookup Find(string keyId, DateTimeOffset now) =>
            Keys.TryGetValue(keyId, out var key) && key.Certificate.NotAfter.ToUniversalTime() > now.UtcDateTime
                ? SigningKeyLookup.Found(key)
                : SigningKeyLookup.Unknown;
    }
}
