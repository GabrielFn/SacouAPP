using System.Net;
using System.Text.Json;
using Sacou.Api.Operations;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Api.Tests.Operations;

/// <summary>Criteria 8 and 15 of E7.2: within 60 s the same answer without a count; after them, a new count.</summary>
public sealed class OpsMetricsCacheTests
{
    private static readonly DateTimeOffset Start = new(2026, 11, 24, 18, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task WithinSixtySeconds_TheSecondRequestIsTheKeptAnswer()
    {
        var clock = new FixedTimeProvider(Start);
        using var cache = new OpsMetricsCache(clock);
        var loads = 0;

        var first = await cache.GetAsync(Load, TestContext.Current.CancellationToken);
        clock.Advance(TimeSpan.FromSeconds(59));
        var second = await cache.GetAsync(Load, TestContext.Current.CancellationToken);

        Assert.Equal(1, loads);
        Assert.False(first.Cached);
        Assert.True(second.Cached);
        Assert.Same(first.Value, second.Value);
        Assert.Equal(Start, second.Value.GeneratedAt);

        clock.Advance(TimeSpan.FromSeconds(1));
        var third = await cache.GetAsync(Load, TestContext.Current.CancellationToken);

        Assert.Equal(2, loads);
        Assert.False(third.Cached);
        Assert.Equal(Start.AddSeconds(60), third.Value.GeneratedAt);
        Assert.Equal(Start.AddSeconds(120), third.Value.CachedUntil);

        Task<OpsMetricsResponse> Load(DateTimeOffset now, CancellationToken cancellationToken)
        {
            loads++;
            return Task.FromResult(new OpsMetricsResponse(OpsEnvironments.Test, now, now + OpsMetricsCache.Lifetime, new OpsUsers(0, 0, [])));
        }
    }

    [Fact]
    public async Task TwoRequestsAtOnce_CountOnce()
    {
        using var cache = new OpsMetricsCache(new FixedTimeProvider(Start));
        var loads = 0;
        var release = new TaskCompletionSource();

        var first = cache.GetAsync(Load, TestContext.Current.CancellationToken);
        var second = cache.GetAsync(Load, TestContext.Current.CancellationToken);
        release.SetResult();
        var answers = await Task.WhenAll(first, second);

        Assert.Equal(1, loads);
        Assert.Same(answers[0].Value, answers[1].Value);

        async Task<OpsMetricsResponse> Load(DateTimeOffset now, CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref loads);
            await release.Task;
            return new OpsMetricsResponse(OpsEnvironments.Test, now, now + OpsMetricsCache.Lifetime, new OpsUsers(0, 0, []));
        }
    }

    /// <summary>Through the route: the fake contract counts one call for two requests, and both say the same "Atualizado às".</summary>
    [Fact]
    public async Task ThroughTheRoute_TheSecondRequestDoesNotReachTheModule()
    {
        await using var host = new OpsHost("uid-operador-abc");
        using var client = host.CreateClient();

        var first = await GetBodyAsync(client);
        var second = await GetBodyAsync(client);

        Assert.Equal(1, host.Identity.Calls);
        Assert.Equal(first.GetProperty("generatedAt").GetString(), second.GetProperty("generatedAt").GetString());
    }

    private static async Task<JsonElement> GetBodyAsync(HttpClient client)
    {
        using var request = OpsHost.Get("uid-operador-abc");
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return body.RootElement.Clone();
    }
}
