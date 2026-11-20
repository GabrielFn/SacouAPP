using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Sacou.Http.RateLimiting;
using Sacou.Modules.Groups;
using Xunit;

namespace Sacou.Api.Tests;

/// <summary>
/// Case 3 of the plan: each route of ADR 0062, D3, has its own policy, written here by hand; every other signed-in
/// route has only the global limit, and an anonymous route has none but the round page (round-page, per client address,
/// ADR 0070, D6). The start fails on a pool too small (D4).
/// </summary>
public sealed class RateLimitedRoutesTests(SacouApiFactory factory) : IClassFixture<SacouApiFactory>
{
    private const string GroupRoute = "/v1/groups/{groupId:guid}";

    /// <summary>Method and route pattern to policy.</summary>
    public static readonly TheoryData<string, string, string> Expected = new()
    {
        { "POST", "/v1/me", RateLimitPolicies.SignIn },
        { "POST", "/v1/invites/preview", RateLimitPolicies.Invite },
        { "POST", "/v1/invites/accept", RateLimitPolicies.Invite },
        { "POST", "/v1/round-links/resolve", RateLimitPolicies.RoundLink },
        { "POST", "/v1/round-links/attendance", RateLimitPolicies.RoundLink },
        { "POST", "/v1/groups", RateLimitPolicies.GroupCreate },
        { "POST", GroupRoute + "/invites", RateLimitPolicies.InviteCreate },
        { "POST", GroupRoute + "/rounds/{roundId:guid}/draw", RateLimitPolicies.Draw },
        { "POST", GroupRoute + "/rounds/{roundId:guid}/court-sessions/{courtSessionId:guid}/events", RateLimitPolicies.CourtSync },
        { "GET", GroupRoute + "/rounds/{roundId:guid}/court-sessions/{courtSessionId:guid}/events", RateLimitPolicies.CourtSync },
        { "POST", GroupRoute + "/rounds/{roundId:guid}/court-sessions/{courtSessionId:guid}/takeover", RateLimitPolicies.CourtSync },
        { "GET", GroupRoute + "/rounds/{roundId:guid}/court-session", RateLimitPolicies.CourtSync },
        { "GET", GroupRoute + "/rounds/{roundId:guid}/mvp-voting", RateLimitPolicies.CourtSync },
        { "POST", GroupRoute + "/rounds/{roundId:guid}/mvp-voting/vote", RateLimitPolicies.CourtSync },
        { "GET", GroupRoute + "/rounds/{roundId:guid}/mvp-voting/result", RateLimitPolicies.CourtSync },
        { "GET", GroupRoute + "/rounds/{roundId:guid}/summary", RateLimitPolicies.CourtSync },
        { "GET", "/v1/me/stats", RateLimitPolicies.CourtSync },
        { "PUT", GroupRoute + "/member-levels", RateLimitPolicies.MemberLevels },
        { "PUT", GroupRoute + "/member-levels/{memberId:guid}", RateLimitPolicies.MemberLevels },
        { "GET", "/v1/me/export", RateLimitPolicies.AccountExport },
        { "DELETE", "/v1/me", RateLimitPolicies.AccountDelete },
        { "PUT", "/v1/me/push-devices/{installationId:guid}", RateLimitPolicies.PushDevice },
        { "GET", "r/{code}", RateLimitPolicies.RoundPage },
        { "HEAD", "r/{code}", RateLimitPolicies.RoundPage },
        { "GET", "c", RateLimitPolicies.RoundPage },
        { "HEAD", "c", RateLimitPolicies.RoundPage },
    };

    [Theory]
    [MemberData(nameof(Expected))]
    public void EachListedRoute_HasItsPolicy(string method, string pattern, string policy)
    {
        var endpoint = Assert.Single(Routes(), route => route.Method == method && route.Pattern == pattern);

        Assert.Equal(policy, endpoint.Policy);
    }

    [Fact]
    public void NoOtherRoute_HasAPolicy_AndNoAnonymousRouteIsLimited()
    {
        var listed = Expected.Select(row => (row.Data.Item1, row.Data.Item2)).ToHashSet();

        var others = Routes().Where(route => !listed.Contains((route.Method, route.Pattern))).ToList();

        Assert.NotEmpty(others);
        Assert.All(others, route => Assert.Null(route.Policy));
    }

    /// <summary>
    /// D4: a pool smaller than two connections per running request plus the headroom stops the start. Runs the
    /// start-up validators on the real composition and the real appsettings.json values, without a host.
    /// </summary>
    [Fact]
    public void SmallPool_StopsTheStart()
    {
        var settings = new ConfigurationBuilder()
            .AddJsonFile(Path.Combine(AppContext.BaseDirectory, "appsettings.json"))
            .AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:Sacou"] = SacouApiFactory.ClosedDatabase + ";Maximum Pool Size=10" })
            .Build();
        using var services = new ServiceCollection().AddLogging().AddGroupsModule(settings).AddSacouRateLimiting(settings).BuildServiceProvider();

        var failure = Assert.Throws<OptionsValidationException>(() => services.GetRequiredService<IOptions<RateLimitingOptions>>().Value);

        Assert.Contains("Maximum Pool Size", failure.Message, StringComparison.Ordinal);
        Assert.DoesNotContain("127.0.0.1", failure.Message, StringComparison.Ordinal);
    }

    private List<(string Method, string Pattern, string? Policy)> Routes() =>
        [.. factory.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .Where(endpoint => endpoint.Metadata.GetMetadata<IAllowAnonymous>() is null || endpoint.Metadata.GetMetadata<EnableRateLimitingAttribute>() is not null)
            .SelectMany(endpoint => (endpoint.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? []).Select(method => (
                method,
                endpoint.RoutePattern.RawText ?? string.Empty,
                endpoint.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName)))];
}
