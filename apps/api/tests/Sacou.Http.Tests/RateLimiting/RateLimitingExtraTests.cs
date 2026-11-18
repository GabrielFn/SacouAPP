using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Sacou.Http.RateLimiting;
using Xunit;

namespace Sacou.Http.Tests.RateLimiting;

/// <summary>Tester additions for ADR 0062: every window rejects bad numbers, the per-user queue overflows into a refusal, anonymous is never limited by user.</summary>
public sealed class RateLimitingExtraTests
{
    private const string Section = RateLimitingOptions.SectionName;
    private const int ManyRequests = 30;

    public static TheoryData<string, string> EveryWindowSetting()
    {
        var data = new TheoryData<string, string>();
        foreach (var section in RateLimitSettings.Sections)
        {
            data.Add(section, "PermitLimit");
            data.Add(section, "WindowSeconds");
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(EveryWindowSetting))]
    public void EveryWindow_WithZero_FailsTheStart(string policy, string setting)
    {
        var settings = RateLimitSettings.Complete();
        settings[$"{Section}:{policy}:{setting}"] = "0";

        using var services = new ServiceCollection().AddSacouRateLimiting(RateLimitSettings.Build(settings)).BuildServiceProvider();

        Assert.Throws<OptionsValidationException>(() => services.GetRequiredService<IOptions<RateLimitingOptions>>().Value);
    }

    [Fact]
    public async Task PerUserQueueFull_RefusesTheNextRequest()
    {
        var settings = RateLimitSettings.Complete(permitLimit: ManyRequests);
        settings[$"{Section}:DualConnectionPerUser"] = "1";
        settings[$"{Section}:DualConnectionPerUserQueue"] = "2";
        using var services = new ServiceCollection().AddLogging().AddSacouRateLimiting(RateLimitSettings.Build(settings)).BuildServiceProvider();
        var global = services.GetRequiredService<IOptions<RateLimiterOptions>>().Value.GlobalLimiter!;
        var cancel = TestContext.Current.CancellationToken;

        using var held = global.AttemptAcquire(Context("uid-a", RateLimitPolicies.GroupCreate));
        var queued1 = global.AcquireAsync(Context("uid-a", RateLimitPolicies.GroupCreate), cancellationToken: cancel);
        var queued2 = global.AcquireAsync(Context("uid-a", RateLimitPolicies.GroupCreate), cancellationToken: cancel);
        var overflow = global.AcquireAsync(Context("uid-a", RateLimitPolicies.GroupCreate), cancellationToken: cancel);

        Assert.True(held.IsAcquired);
        Assert.False(queued1.IsCompleted);
        Assert.False(queued2.IsCompleted);
        using var refused = await overflow.AsTask().WaitAsync(TimeSpan.FromSeconds(10), cancel);
        Assert.False(refused.IsAcquired);
        Assert.Equal(1, RateLimitRejection.RetryAfterSeconds(refused));
    }

    [Fact]
    public void Anonymous_OnADualConnectionRoute_IsNotLimitedByTheUserPartitions()
    {
        var settings = RateLimitSettings.Complete(permitLimit: 1);
        settings[$"{Section}:DualConnectionConcurrency"] = "100";
        using var services = new ServiceCollection().AddLogging().AddSacouRateLimiting(RateLimitSettings.Build(settings)).BuildServiceProvider();
        var global = services.GetRequiredService<IOptions<RateLimiterOptions>>().Value.GlobalLimiter!;
        var anonymous = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) };
        anonymous.SetEndpoint(new Endpoint(null, new EndpointMetadataCollection(new EnableRateLimitingAttribute(RateLimitPolicies.Invite)), "x"));

        var leases = Enumerable.Range(0, ManyRequests).Select(_ => global.AttemptAcquire(anonymous)).ToList();

        Assert.All(leases, lease => Assert.True(lease.IsAcquired));
        leases.ForEach(lease => lease.Dispose());
    }

    /// <summary>The windows never queue: past the limit the answer is a refusal at once, not a wait.</summary>
    [Fact]
    public async Task WindowPastTheLimit_RefusesAtOnce_WithoutQueueing()
    {
        using var services = new ServiceCollection().AddLogging().AddSacouRateLimiting(RateLimitSettings.Build(RateLimitSettings.Complete(permitLimit: 1))).BuildServiceProvider();
        var global = services.GetRequiredService<IOptions<RateLimiterOptions>>().Value.GlobalLimiter!;
        var cancel = TestContext.Current.CancellationToken;
        var context = new DefaultHttpContext { User = RateLimitPartitionKeyTests.SignedIn("uid-a") };

        using var first = await global.AcquireAsync(context, cancellationToken: cancel);
        var second = global.AcquireAsync(context, cancellationToken: cancel);

        Assert.True(second.IsCompleted);
        using var refused = await second;
        Assert.True(first.IsAcquired);
        Assert.False(refused.IsAcquired);
    }

    private static DefaultHttpContext Context(string subject, string policy)
    {
        var context = new DefaultHttpContext { User = RateLimitPartitionKeyTests.SignedIn(subject) };
        context.SetEndpoint(new Endpoint(null, new EndpointMetadataCollection(new EnableRateLimitingAttribute(policy)), policy));
        return context;
    }
}
