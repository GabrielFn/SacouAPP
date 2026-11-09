using System.Net;
using System.Text;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Sacou.Modules.Identity.Authentication;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Modules.Identity.Tests.Authentication;

/// <summary>K1 to K7: the Google keys through the real named client, with a stub handler and a fixed clock.</summary>
public sealed class GoogleSigningKeySourceTests : IDisposable
{
    private static readonly TimeSpan OneHour = TimeSpan.FromHours(1);

    private readonly TestSigningKey first = TestSigningKey.Create("first");
    private readonly TestSigningKey second = TestSigningKey.Create("second");
    private readonly FixedTimeProvider clock = new(FixedTimeProvider.WholeSecondNow());
    private readonly CollectingLoggerProvider logs = new();
    private readonly List<ServiceProvider> providers = [];
    private readonly ILoggerFactory loggers;

    public GoogleSigningKeySourceTests() => loggers = LoggerFactory.Create(builder => builder.AddProvider(logs));

    [Fact]
    public async Task Document_GivesOneKeyPerKid()
    {
        using var source = Source(_ => StubHttpHandler.Json(TestSigningKeys.Document(first, second), OneHour), out _);

        Assert.Equal(SigningKeyStatus.Found, (await FindAsync(source, "first")).Status);
        Assert.Equal(SigningKeyStatus.Found, (await FindAsync(source, "second")).Status);
        Assert.Equal(SigningKeyStatus.Unknown, (await FindAsync(source, "third")).Status);
    }

    [Fact]
    public async Task DocumentWithOneBadEntry_IsRefusedWholeAndTheOldKeysStay()
    {
        var responses = new Queue<string>([
            TestSigningKeys.Document(first),
            $$"""{"second":{{TestIdToken.Json(second.CertificatePem)}},"broken":"-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----"}""",
        ]);
        using var source = Source(_ => StubHttpHandler.Json(responses.Dequeue(), TimeSpan.FromMinutes(5)), out var stub);
        await FindAsync(source, "first");

        clock.Advance(TimeSpan.FromMinutes(6));

        Assert.Equal(SigningKeyStatus.Found, (await FindAsync(source, "first")).Status);
        Assert.Equal(SigningKeyStatus.Unknown, (await FindAsync(source, "second")).Status);
        Assert.Equal(2, stub.RequestCount);
    }

    [Fact]
    public async Task MaxAge_IsRespected()
    {
        using var source = Source(_ => StubHttpHandler.Json(TestSigningKeys.Document(first), OneHour), out var stub);
        await FindAsync(source, "first");

        clock.Advance(OneHour - TimeSpan.FromSeconds(1));
        await FindAsync(source, "first");
        Assert.Equal(1, stub.RequestCount);

        clock.Advance(TimeSpan.FromSeconds(1));
        await FindAsync(source, "first");
        Assert.Equal(2, stub.RequestCount);
    }

    [Theory]
    [InlineData(null, 5 * 60)]
    [InlineData(0, 5 * 60)]
    [InlineData(60, 5 * 60)]
    [InlineData(6 * 3600, 6 * 3600)]
    [InlineData(48 * 3600, 24 * 3600)]
    public void CacheLifetime_IsClampedBetweenFiveMinutesAndOneDay(int? maxAgeSeconds, int expectedSeconds)
    {
        TimeSpan? maxAge = maxAgeSeconds is { } seconds ? TimeSpan.FromSeconds(seconds) : null;

        Assert.Equal(TimeSpan.FromSeconds(expectedSeconds), GoogleSigningKeySource.CacheLifetime(maxAge));
    }

    [Fact]
    public async Task FailedFetchWithCache_KeepsTheOldKeysAndWarns()
    {
        var fail = false;
        using var source = Source(
            _ => fail ? new HttpResponseMessage(HttpStatusCode.InternalServerError) : StubHttpHandler.Json(TestSigningKeys.Document(first), null),
            out var stub);
        await FindAsync(source, "first");
        fail = true;

        clock.Advance(TimeSpan.FromMinutes(10));

        Assert.Equal(SigningKeyStatus.Found, (await FindAsync(source, "first")).Status);
        Assert.Equal(2, stub.RequestCount);
        Assert.Contains(logs.Entries, entry => entry.Contains("Using the cached ID token signing keys", StringComparison.Ordinal));
    }

    [Fact]
    public async Task CachedKeyWithAnExpiredCertificate_IsNotUsed()
    {
        using var expiring = TestSigningKey.Create("expiring", clock.GetUtcNow() + TimeSpan.FromMinutes(30));
        var fail = false;
        using var source = Source(
            _ => fail ? new HttpResponseMessage(HttpStatusCode.InternalServerError) : StubHttpHandler.Json(TestSigningKeys.Document(expiring), null),
            out _);
        await FindAsync(source, "expiring");
        fail = true;

        clock.Advance(OneHour);

        Assert.Equal(SigningKeyStatus.Unknown, (await FindAsync(source, "expiring")).Status);
    }

    [Fact]
    public async Task FailedFetchWithoutCache_IsUnavailable()
    {
        using var source = Source(_ => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable), out _);

        Assert.Equal(SigningKeyStatus.Unavailable, (await FindAsync(source, "first")).Status);
    }

    public static TheoryData<string> BadResponses => ["500", "302", "invalid json", "array", "empty object", "over 64 KB", "network"];

    [Theory]
    [MemberData(nameof(BadResponses))]
    public async Task BadResponse_IsAFailedFetch(string kind)
    {
        using var source = Source(_ => BadResponse(kind), out var stub);

        Assert.Equal(SigningKeyStatus.Unavailable, (await FindAsync(source, "first")).Status);
        Assert.Equal(1, stub.RequestCount);
    }

    [Fact]
    public async Task ConcurrentUnknownKids_FetchOnceThenWaitFiveMinutes()
    {
        using var source = Source(_ => StubHttpHandler.Json(TestSigningKeys.Document(first), OneHour), out var stub, TimeSpan.FromMilliseconds(50));
        await FindAsync(source, "first");
        clock.Advance(TimeSpan.FromMinutes(5));

        var lookups = await Task.WhenAll(Enumerable.Range(0, 50).Select(index => FindAsync(source, $"random-{index}")));
        Assert.All(lookups, lookup => Assert.Equal(SigningKeyStatus.Unknown, lookup.Status));
        Assert.Equal(2, stub.RequestCount);

        clock.Advance(TimeSpan.FromMinutes(4));
        await FindAsync(source, "another-random");
        Assert.Equal(2, stub.RequestCount);
    }

    [Fact]
    public async Task FetchedUrl_IsExactlyTheDocumentedHttpsUrl()
    {
        using var source = Source(_ => StubHttpHandler.Json(TestSigningKeys.Document(first), OneHour), out var stub);

        await FindAsync(source, "first");

        Assert.Equal(
            new Uri("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"),
            Assert.Single(stub.RequestedUris));
    }

    [Fact]
    public void PrimaryHandler_NeverFollowsRedirects()
    {
        using var handler = GoogleSigningKeyFetcher.CreatePrimaryHandler();

        Assert.False(handler.AllowAutoRedirect);
    }

    /// <summary>S1: the deadline covers the body, so a body that never ends cannot hold the refresh lock.</summary>
    [Fact]
    public async Task BodyThatNeverEnds_IsATimedOutFetch()
    {
        var shortDeadline = TimeSpan.FromMilliseconds(300);
        using var source = Source(_ => BodyOf(new BrokenBodyStream()), out _, shortDeadline);

        var lookup = source.FindAsync("first", TestContext.Current.CancellationToken);

        var finished = await Task.WhenAny(lookup, Task.Delay(TimeSpan.FromSeconds(10), TestContext.Current.CancellationToken));
        Assert.Same(lookup, finished);
        Assert.Equal(SigningKeyStatus.Unavailable, (await lookup).Status);
        Assert.Contains(logs.Entries, entry => entry.Contains("failed: timeout", StringComparison.Ordinal));
    }

    /// <summary>S2: a body cut in the middle is a network failure, never an exception that becomes a 500.</summary>
    [Fact]
    public async Task BodyCutInTheMiddle_IsANetworkFailure()
    {
        using var source = Source(_ => BodyOf(new BrokenBodyStream(new IOException("connection reset"))), out _);

        Assert.Equal(SigningKeyStatus.Unavailable, (await FindAsync(source, "first")).Status);
        Assert.Contains(logs.Entries, entry => entry.Contains("failed: network", StringComparison.Ordinal));
        Assert.DoesNotContain(logs.Entries, entry => entry.Contains("connection reset", StringComparison.Ordinal));
    }

    [Fact]
    public async Task BodyCutInTheMiddleWithCache_KeepsTheOldKeys()
    {
        var cut = false;
        using var source = Source(
            _ => cut ? BodyOf(new BrokenBodyStream(new IOException("reset"))) : StubHttpHandler.Json(TestSigningKeys.Document(first), null),
            out _);
        await FindAsync(source, "first");
        cut = true;

        clock.Advance(TimeSpan.FromMinutes(10));

        Assert.Equal(SigningKeyStatus.Found, (await FindAsync(source, "first")).Status);
    }

    /// <summary>S3: with no keys and Google failing, callers get 503 at once, and Google sees one fetch per 10 s.</summary>
    [Fact]
    public async Task ColdFailures_FetchAtMostOncePerTenSeconds()
    {
        using var source = Source(_ => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable), out var stub);

        for (var index = 0; index < 20; index++)
        {
            Assert.Equal(SigningKeyStatus.Unavailable, (await FindAsync(source, $"kid-{index}")).Status);
        }

        Assert.Equal(1, stub.RequestCount);
        clock.Advance(GoogleSigningKeySource.MinTimeBetweenColdFetches);
        await FindAsync(source, "kid-again");
        Assert.Equal(2, stub.RequestCount);
    }

    [Fact]
    public async Task ColdFailureThenRecovery_FindsTheKeysAfterTheInterval()
    {
        var down = true;
        using var source = Source(
            _ => down ? new HttpResponseMessage(HttpStatusCode.ServiceUnavailable) : StubHttpHandler.Json(TestSigningKeys.Document(first), OneHour),
            out _);
        await FindAsync(source, "first");
        down = false;

        Assert.Equal(SigningKeyStatus.Unavailable, (await FindAsync(source, "first")).Status);
        clock.Advance(GoogleSigningKeySource.MinTimeBetweenColdFetches);
        Assert.Equal(SigningKeyStatus.Found, (await FindAsync(source, "first")).Status);
    }

    private static HttpResponseMessage BodyOf(Stream body) =>
        new(HttpStatusCode.OK) { Content = new StreamContent(body) };

    public void Dispose()
    {
        first.Dispose();
        second.Dispose();
        providers.ForEach(provider => provider.Dispose());
        loggers.Dispose();
        logs.Dispose();
    }

    private static Task<SigningKeyLookup> FindAsync(GoogleSigningKeySource source, string keyId) =>
        source.FindAsync(keyId, TestContext.Current.CancellationToken);

    private GoogleSigningKeySource Source(
        Func<HttpRequestMessage, HttpResponseMessage> respond, out StubHttpHandler stub, TimeSpan delay = default) =>
        Source(respond, out stub, GoogleSigningKeyFetcher.Timeout, delay);

    private GoogleSigningKeySource Source(
        Func<HttpRequestMessage, HttpResponseMessage> respond, out StubHttpHandler stub, TimeSpan fetchTimeout, TimeSpan delay = default)
    {
        var handler = new StubHttpHandler(respond) { Delay = delay };
        stub = handler;
        var services = new ServiceCollection();
        services.AddHttpClient(IdentityModule.SigningKeysHttpClientName).ConfigurePrimaryHttpMessageHandler(() => handler);
        var provider = services.BuildServiceProvider();
        providers.Add(provider);
        var factory = provider.GetRequiredService<IHttpClientFactory>();
        var fetcher = new GoogleSigningKeyFetcher(factory, loggers.CreateLogger<GoogleSigningKeyFetcher>()) { FetchTimeout = fetchTimeout };
        return new GoogleSigningKeySource(fetcher, clock, loggers.CreateLogger<GoogleSigningKeySource>());
    }

    private HttpResponseMessage BadResponse(string kind) => kind switch
    {
        "500" => new HttpResponseMessage(HttpStatusCode.InternalServerError),
        "302" => Redirect(),
        "invalid json" => StubHttpHandler.Json("{not json", OneHour),
        "array" => StubHttpHandler.Json("[]", OneHour),
        "empty object" => StubHttpHandler.Json("{}", OneHour),
        "over 64 KB" => StubHttpHandler.Json(
            $$"""{"first":{{TestIdToken.Json(first.CertificatePem)}},"pad":"{{new string('a', GoogleSigningKeyFetcher.MaxDocumentBytes)}}"}""", OneHour),
        _ => throw new HttpRequestException("network down"),
    };

    private static HttpResponseMessage Redirect()
    {
        var response = new HttpResponseMessage(HttpStatusCode.Found) { Content = new StringContent(string.Empty, Encoding.UTF8) };
        response.Headers.Location = new Uri("https://attacker.example/keys");
        return response;
    }
}
