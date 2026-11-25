using System.Net;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Sacou.Http.AppConfig;
using Xunit;

namespace Sacou.Api.Tests;

/// <summary>Cases 11, 14 (routes), 15 and 16 of the plan: the anonymous app config, its limit and the routes behind a flag (ADR 0084).</summary>
public sealed class AppConfigEndpointTests(SacouApiFactory factory) : IClassFixture<SacouApiFactory>
{
    private const string Route = "/v1/app-config";
    private const string GroupRoute = "/v1/groups/{groupId:guid}";
    private const int LimitPerWindow = 60;
    private static readonly string[] ExpectedTopLevel = ["features", "minimumBuild", "updateUrl"];

    /// <summary>The routes behind a flag, by hand: a new one fails here until it is listed.</summary>
    public static readonly TheoryData<string, string, AppFeature> FlaggedRoutes = new()
    {
        { "GET", GroupRoute + "/rounds/{roundId:guid}/mvp-voting", AppFeature.MvpVote },
        { "POST", GroupRoute + "/rounds/{roundId:guid}/mvp-voting/vote", AppFeature.MvpVote },
        { "GET", GroupRoute + "/rounds/{roundId:guid}/mvp-voting/result", AppFeature.MvpVote },
    };

    [Fact]
    public async Task Get_WithoutAToken_ReturnsTheClosedShapeAndNeverTouchesTheDatabase()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(Route, TestContext.Current.CancellationToken);
        var body = (await JsonNode.ParseAsync(await response.Content.ReadAsStreamAsync(TestContext.Current.CancellationToken), cancellationToken: TestContext.Current.CancellationToken))!.AsObject();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(ExpectedTopLevel, body.Select(pair => pair.Key).Order(StringComparer.Ordinal));
        Assert.Equal(1, body["minimumBuild"]!["android"]!.GetValue<int>());
        Assert.Equal(1, body["minimumBuild"]!["ios"]!.GetValue<int>());
        Assert.Null(body["updateUrl"]!["android"]);
        Assert.Equal(["mvpVote"], body["features"]!.AsObject().Select(pair => pair.Key));
        Assert.True(body["features"]!["mvpVote"]!.GetValue<bool>());
        Assert.Equal("public, max-age=60", response.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task Get_AppBelowTheMinimum_StillReadsTheConfig()
    {
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, Route);
        request.Headers.Add(AppBuildGate.PlatformHeader, "android");
        request.Headers.Add(AppBuildGate.BuildHeader, "0");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task SignedInRoute_WithAnOutdatedApp_Is426BeforeTheTokenIsRead()
    {
        using var raised = factory.WithWebHostBuilder(builder => builder.UseSetting("AppConfig:MinimumBuild:Android", "5"));
        using var client = raised.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/v1/me/stats");
        request.Headers.Add(AppBuildGate.PlatformHeader, "android");
        request.Headers.Add(AppBuildGate.BuildHeader, "4");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        using var current = new HttpRequestMessage(HttpMethod.Get, "/v1/me/stats");
        current.Headers.Add(AppBuildGate.PlatformHeader, "android");
        current.Headers.Add(AppBuildGate.BuildHeader, "5");
        using var accepted = await client.SendAsync(current, TestContext.Current.CancellationToken);

        Assert.Equal((HttpStatusCode)426, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, accepted.StatusCode);
    }

    [Fact]
    public async Task Get_PastTheLimit_IsTooManyRequestsPerLastForwardedAddress()
    {
        using var client = factory.CreateClient();

        for (var count = 0; count < LimitPerWindow; count++)
        {
            using var allowed = await Get(client, "198.51.100.7");
            Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
        }

        using var refused = await Get(client, "198.51.100.7");
        using var forged = await Get(client, "203.0.113.9, 198.51.100.7");
        using var other = await Get(client, "198.51.100.8");

        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, forged.StatusCode);
        Assert.Equal(HttpStatusCode.OK, other.StatusCode);
        Assert.Equal("application/problem+json", refused.Content.Headers.ContentType?.MediaType);
    }

    [Theory]
    [MemberData(nameof(FlaggedRoutes))]
    public void EachListedRoute_RequiresItsFlag(string method, string pattern, AppFeature feature)
    {
        var route = Assert.Single(Routes(), candidate => candidate.Method == method && candidate.Pattern == pattern);

        Assert.Equal([feature], route.Features);
    }

    [Fact]
    public void NoOtherRoute_RequiresAFlag()
    {
        var listed = FlaggedRoutes.Select(row => (row.Data.Item1, row.Data.Item2)).ToHashSet();

        var others = Routes().Where(route => !listed.Contains((route.Method, route.Pattern))).ToList();

        Assert.NotEmpty(others);
        Assert.All(others, route => Assert.Empty(route.Features));
    }

    [Fact]
    public void TheConfigRoute_IsTheOnlyNewAnonymousRouteUnderV1()
    {
        var anonymous = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .Where(endpoint => endpoint.Metadata.GetMetadata<IAllowAnonymous>() is not null)
            .Select(endpoint => endpoint.RoutePattern.RawText)
            .Where(pattern => pattern is not null && pattern.StartsWith("/v1", StringComparison.Ordinal))
            .ToList();

        Assert.Equal([Route], anonymous);
    }

    private static Task<HttpResponseMessage> Get(HttpClient client, string forwardedFor)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, Route);
        request.Headers.Add("X-Forwarded-For", forwardedFor);
        return client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private List<(string Method, string Pattern, AppFeature[] Features)> Routes() =>
        [.. factory.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .SelectMany(endpoint => (endpoint.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? []).Select(method => (
                method,
                endpoint.RoutePattern.RawText ?? string.Empty,
                endpoint.Metadata.GetOrderedMetadata<FeatureRequirement>().Select(requirement => requirement.Flag).ToArray())))];
}
