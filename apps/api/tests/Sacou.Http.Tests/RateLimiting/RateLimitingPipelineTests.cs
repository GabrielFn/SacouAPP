using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Sacou.Http.RateLimiting;
using Xunit;

namespace Sacou.Http.Tests.RateLimiting;

/// <summary>The limiters the configuration builds: per user, none without a user, and one shared gate for the two-connection routes.</summary>
public sealed class RateLimitingPipelineTests
{
    private const int Permits = 3;
    private const int ManyRequests = 30;
    private static readonly TimeSpan TurnDeadline = TimeSpan.FromSeconds(10);

    [Fact]
    public void Global_RefusesTheSameUserPastTheLimit_NotAnother()
    {
        using var services = Build(RateLimitSettings.Complete(Permits));
        var global = Global(services);

        var allowed = Acquire(global, Context("uid-a", policy: null), Permits);
        using var refused = global.AttemptAcquire(Context("uid-a", policy: null));
        using var other = global.AttemptAcquire(Context("uid-b", policy: null));

        Assert.All(allowed, lease => Assert.True(lease.IsAcquired));
        Assert.False(refused.IsAcquired);
        Assert.True(other.IsAcquired);
        allowed.ForEach(lease => lease.Dispose());
    }

    /// <summary>A request without a user (the health check) never meets a limit.</summary>
    [Fact]
    public void Global_WithoutAUser_HasNoLimit()
    {
        using var services = Build(RateLimitSettings.Complete(Permits));
        var global = Global(services);
        var anonymous = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) };

        var leases = Acquire(global, anonymous, ManyRequests);

        Assert.All(leases, lease => Assert.True(lease.IsAcquired));
        leases.ForEach(lease => lease.Dispose());
    }

    /// <summary>D4: the gate is shared by everyone, so two users together fill the concurrency of the two-connection routes.</summary>
    [Fact]
    public void DualConnectionRoutes_ShareOneConcurrencyGate()
    {
        var settings = RateLimitSettings.Complete(permitLimit: ManyRequests);
        settings[$"{RateLimitingOptions.SectionName}:DualConnectionConcurrency"] = "2";
        using var services = Build(settings);
        var global = Global(services);

        using var first = global.AttemptAcquire(Context("uid-a", RateLimitPolicies.GroupCreate));
        using var second = global.AttemptAcquire(Context("uid-b", RateLimitPolicies.Invite));
        using var third = global.AttemptAcquire(Context("uid-c", RateLimitPolicies.GroupCreate));
        using var elsewhere = global.AttemptAcquire(Context("uid-c", RateLimitPolicies.Draw));

        Assert.True(first.IsAcquired);
        Assert.True(second.IsAcquired);
        Assert.False(third.IsAcquired);
        Assert.True(elsewhere.IsAcquired);
    }

    /// <summary>
    /// The limiters run before the body is read, so a slow body keeps its lease. One account holding its request and
    /// waiting with more never takes a second place of the shared gate: another person still gets one at once.
    /// </summary>
    [Fact]
    public async Task SlowAccount_HoldsOnePlaceOfTheGate_NotTheOthers()
    {
        var settings = RateLimitSettings.Complete(permitLimit: ManyRequests);
        settings[$"{RateLimitingOptions.SectionName}:DualConnectionConcurrency"] = "2";
        using var services = Build(settings);
        var global = Global(services);

        using var slow = global.AttemptAcquire(Context("uid-slow", RateLimitPolicies.GroupCreate));
        var waiting = global.AcquireAsync(Context("uid-slow", RateLimitPolicies.Invite), cancellationToken: TestContext.Current.CancellationToken);
        using var other = global.AttemptAcquire(Context("uid-other", RateLimitPolicies.GroupCreate));

        Assert.True(slow.IsAcquired);
        Assert.False(waiting.IsCompleted);
        Assert.True(other.IsAcquired);
        slow.Dispose();
        other.Dispose();
        using var turn = await waiting.AsTask().WaitAsync(TurnDeadline, TestContext.Current.CancellationToken);
        Assert.True(turn.IsAcquired);
    }

    [Fact]
    public void Rejection_Is429_WrittenBySacou()
    {
        using var services = Build(RateLimitSettings.Complete());

        var options = services.GetRequiredService<IOptions<RateLimiterOptions>>().Value;

        Assert.Equal(StatusCodes.Status429TooManyRequests, options.RejectionStatusCode);
        Assert.NotNull(options.OnRejected);
    }

    private static ServiceProvider Build(IReadOnlyDictionary<string, string?> settings) =>
        new ServiceCollection().AddLogging().AddSacouRateLimiting(RateLimitSettings.Build(settings)).BuildServiceProvider();

    private static PartitionedRateLimiter<HttpContext> Global(ServiceProvider services) =>
        services.GetRequiredService<IOptions<RateLimiterOptions>>().Value.GlobalLimiter!;

    private static List<RateLimitLease> Acquire(PartitionedRateLimiter<HttpContext> limiter, HttpContext context, int count) =>
        [.. Enumerable.Range(0, count).Select(_ => limiter.AttemptAcquire(context))];

    private static DefaultHttpContext Context(string subject, string? policy)
    {
        var context = new DefaultHttpContext { User = RateLimitPartitionKeyTests.SignedIn(subject) };
        if (policy is not null)
        {
            context.SetEndpoint(new Endpoint(null, new EndpointMetadataCollection(new EnableRateLimitingAttribute(policy)), policy));
        }

        return context;
    }
}
