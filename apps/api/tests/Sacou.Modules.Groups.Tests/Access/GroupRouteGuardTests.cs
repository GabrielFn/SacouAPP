using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Domain.Permissions;
using Xunit;

namespace Sacou.Modules.Groups.Tests.Access;

/// <summary>A4: the guard on the real API, then on planted routes (an untested rule proves nothing).</summary>
public sealed class GroupRouteGuardTests
{
    private const string Planted = "/v1/groups/{groupId:guid}/planted";

    /// <summary>
    /// Get, rename, list members, change role and type, remove, leave, and create, list and revoke invites, and the six
    /// of the settings and the saved templates: the guard must see them, or it checks nothing.
    /// </summary>
    private const int GroupRoutes = 16;

    private const string Development = "Development";
    private const string Production = "Production";

    [Theory]
    [InlineData(Development)]
    [InlineData(Production)]
    public async Task RealApi_EveryRouteIsGuardedOrListed(string environment)
    {
        await using var api = new ClosedDatabaseApi(environment);
        var endpoints = api.Services.GetRequiredService<EndpointDataSource>().Endpoints;

        Assert.Empty(GroupRouteGuard.Violations(endpoints, environment == Development));
        Assert.Equal(GroupRoutes, endpoints.OfType<RouteEndpoint>().Count(endpoint => endpoint.RoutePattern.GetParameter(GroupAccessFilter.GroupIdRouteValue) is not null));
    }

    /// <summary>A2 of E3.3: reading the settings is <c>ViewGroup</c>; everything else about settings and templates is <c>ManageSettings</c>.</summary>
    [Fact]
    public async Task RealApi_SettingsRoutesDeclareTheirPermission()
    {
        await using var api = new ClosedDatabaseApi(Production);
        var declared = api.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .Where(endpoint => endpoint.RoutePattern.RawText!.Contains("/settings", StringComparison.Ordinal)
                || endpoint.RoutePattern.RawText.Contains("/templates", StringComparison.Ordinal))
            .ToDictionary(
                endpoint => $"{string.Join(',', endpoint.Metadata.GetMetadata<IHttpMethodMetadata>()!.HttpMethods)} {endpoint.RoutePattern.RawText}",
                endpoint => endpoint.Metadata.GetMetadata<GroupPermissionMetadata>()!.Permission);

        Assert.Equal(
            new Dictionary<string, GroupPermission>
            {
                ["GET /v1/groups/{groupId:guid}/settings"] = GroupPermission.ViewGroup,
                ["PATCH /v1/groups/{groupId:guid}/settings"] = GroupPermission.ManageSettings,
                ["POST /v1/groups/{groupId:guid}/settings/apply-template"] = GroupPermission.ManageSettings,
                ["GET /v1/groups/{groupId:guid}/templates"] = GroupPermission.ManageSettings,
                ["POST /v1/groups/{groupId:guid}/templates"] = GroupPermission.ManageSettings,
                ["DELETE /v1/groups/{groupId:guid}/templates/{templateId:guid}"] = GroupPermission.ManageSettings,
            },
            declared);
    }

    /// <summary>In Production the closed list is exactly the one of ADR 0040; Development adds only the OpenAPI document.</summary>
    [Theory]
    [InlineData(Development)]
    [InlineData(Production)]
    public async Task RealApi_ListsEveryRouteOutsideTheFilter(string environment)
    {
        await using var api = new ClosedDatabaseApi(environment);
        var outside = api.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .Where(endpoint => endpoint.RoutePattern.GetParameter(GroupAccessFilter.GroupIdRouteValue) is null)
            .Select(endpoint => $"{string.Join(',', endpoint.Metadata.GetMetadata<IHttpMethodMetadata>()?.HttpMethods ?? ["*"])} {endpoint.RoutePattern.RawText}");

        Assert.Equal(GroupRouteGuard.RoutesOutsideTheGroupFilterIn(environment == Development).Order(StringComparer.Ordinal), outside.Order(StringComparer.Ordinal));
    }

    /// <summary>
    /// Every Groups route, the invite ones included, caps the body at 4 KB. Kestrel applies the metadata; the TestServer of the
    /// integration tests does not, so the 413 itself is tested with Kestrel in part 2 (M8).
    /// </summary>
    [Fact]
    public async Task RealApi_GroupRoutesCapTheBody()
    {
        await using var api = new ClosedDatabaseApi(Production);
        var groupRoutes = api.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .Where(endpoint => endpoint.RoutePattern.RawText!.StartsWith(GroupRouteExtensions.GroupsRoute, StringComparison.Ordinal)
                || endpoint.RoutePattern.RawText.StartsWith(GroupRouteExtensions.InvitesRoute, StringComparison.Ordinal))
            .ToList();

        Assert.Contains(groupRoutes, endpoint => endpoint.RoutePattern.RawText!.StartsWith(GroupRouteExtensions.InvitesRoute, StringComparison.Ordinal));
        Assert.All(groupRoutes, endpoint => Assert.Equal(
            GroupRouteExtensions.MaxBodyBytes,
            endpoint.Metadata.GetMetadata<Microsoft.AspNetCore.Http.Metadata.IRequestSizeLimitMetadata>()?.MaxRequestBodySize));
    }

    [Fact]
    public void GroupRouteWithOnePermission_IsNotReported()
    {
        var app = PlantedApp();
        app.MapGroupRoutes().MapGet("/planted", () => 1).RequireGroupPermission(GroupPermission.ViewGroup);

        Assert.Empty(GroupRouteGuard.Violations(Endpoints(app)));
    }

    /// <summary>Caught when the endpoints are built, which Program forces at start-up: the API never comes up.</summary>
    [Fact]
    public void GroupRouteWithoutPermission_FailsWhenTheEndpointsAreBuilt()
    {
        var app = PlantedApp();
        app.MapGroupRoutes().MapGet("/planted", () => 1);

        var error = Assert.Throws<InvalidOperationException>(() => Endpoints(app).ToList());
        Assert.Contains("declares 0 permissions", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void GroupRouteWithTwoPermissions_FailsWhenTheEndpointsAreBuilt()
    {
        var app = PlantedApp();
        app.MapGroupRoutes().MapGet("/planted", () => 1)
            .RequireGroupPermission(GroupPermission.ViewGroup).RequireGroupPermission(GroupPermission.RenameGroup);

        var error = Assert.Throws<InvalidOperationException>(() => Endpoints(app).ToList());
        Assert.Contains("declares 2 permissions", error.Message, StringComparison.Ordinal);
    }

    /// <summary>The guard still reports it for a route built with the group id but outside MapGroupRoutes.</summary>
    [Fact]
    public void GroupIdRouteWithoutPermission_IsReported()
    {
        var app = PlantedApp();
        app.MapGet(Planted, () => 1).WithMetadata(GroupAccessFilterMetadata.Instance);

        Assert.Equal([$"GET {Planted}: declares 0 permissions, not one"], GroupRouteGuard.Violations(Endpoints(app)));
    }

    [Fact]
    public void GroupIdRouteOutsideTheFilter_IsReported()
    {
        var app = PlantedApp();
        app.MapGet(Planted, () => 1).RequireGroupPermission(GroupPermission.ViewGroup);

        Assert.Equal([$"GET {Planted}: without the group access filter"], GroupRouteGuard.Violations(Endpoints(app)));
    }

    [Fact]
    public void OpenApiDocument_IsReportedOutsideDevelopment()
    {
        var app = PlantedApp();
        app.MapGet("/openapi/{documentName}.json", () => 1);

        Assert.Single(GroupRouteGuard.Violations(Endpoints(app)));
        Assert.Empty(GroupRouteGuard.Violations(Endpoints(app), development: true));
    }

    [Fact]
    public void RouteOutsideTheClosedList_IsReported()
    {
        var app = PlantedApp();
        app.MapPost("/v1/groups/search", () => 1);

        Assert.Single(GroupRouteGuard.Violations(Endpoints(app)));
    }

    private static WebApplication PlantedApp() => WebApplication.CreateBuilder().Build();

    private static IEnumerable<Endpoint> Endpoints(WebApplication app) =>
        ((IEndpointRouteBuilder)app).DataSources.SelectMany(source => source.Endpoints);

    /// <summary>The real Program with no migration and a database nobody listens on.</summary>
    private sealed class ClosedDatabaseApi(string environment) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment(environment);
            builder.UseSetting("Firebase:ProjectId", "sacou-test-project");
            builder.UseSetting("ConnectionStrings:Sacou", "Host=127.0.0.1;Port=1;Database=sacou;Username=sacou;Timeout=2");
            builder.UseSetting("Database:MigrateOnStartup", "false");
        }
    }
}
