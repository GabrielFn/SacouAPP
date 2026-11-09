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

    /// <summary>Get, rename and list members: the guard must see them, or it checks nothing.</summary>
    private const int GroupRoutesInPart1 = 3;

    [Fact]
    public async Task RealApi_EveryRouteIsGuardedOrListed()
    {
        await using var api = new ClosedDatabaseApi();
        var endpoints = api.Services.GetRequiredService<EndpointDataSource>().Endpoints;

        Assert.Empty(GroupRouteGuard.Violations(endpoints));
        Assert.Equal(GroupRoutesInPart1, endpoints.OfType<RouteEndpoint>().Count(endpoint => endpoint.RoutePattern.GetParameter(GroupAccessFilter.GroupIdRouteValue) is not null));
    }

    [Fact]
    public async Task RealApi_ListsEveryRouteOutsideTheFilter()
    {
        await using var api = new ClosedDatabaseApi();
        var outside = api.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .Where(endpoint => endpoint.RoutePattern.GetParameter(GroupAccessFilter.GroupIdRouteValue) is null)
            .Select(endpoint => $"{string.Join(',', endpoint.Metadata.GetMetadata<IHttpMethodMetadata>()?.HttpMethods ?? ["*"])} {endpoint.RoutePattern.RawText}");

        Assert.Equal(GroupRouteGuard.RoutesOutsideTheGroupFilter.Order(StringComparer.Ordinal), outside.Order(StringComparer.Ordinal));
    }

    [Fact]
    public void GroupRouteWithOnePermission_IsNotReported()
    {
        var app = PlantedApp();
        app.MapGroupRoutes().MapGet("/planted", () => 1).RequireGroupPermission(GroupPermission.ViewGroup);

        Assert.Empty(GroupRouteGuard.Violations(Endpoints(app)));
    }

    [Fact]
    public void GroupRouteWithoutPermission_IsReported()
    {
        var app = PlantedApp();
        app.MapGroupRoutes().MapGet("/planted", () => 1);

        Assert.Equal([$"GET {Planted}: declares 0 permissions, not one"], GroupRouteGuard.Violations(Endpoints(app)));
    }

    [Fact]
    public void GroupRouteWithTwoPermissions_IsReported()
    {
        var app = PlantedApp();
        app.MapGroupRoutes().MapGet("/planted", () => 1)
            .RequireGroupPermission(GroupPermission.ViewGroup).RequireGroupPermission(GroupPermission.RenameGroup);

        Assert.Single(GroupRouteGuard.Violations(Endpoints(app)));
    }

    [Fact]
    public void GroupIdRouteOutsideTheFilter_IsReported()
    {
        var app = PlantedApp();
        app.MapGet(Planted, () => 1).RequireGroupPermission(GroupPermission.ViewGroup);

        Assert.Equal([$"GET {Planted}: without the group access filter"], GroupRouteGuard.Violations(Endpoints(app)));
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
    private sealed class ClosedDatabaseApi : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseSetting("Firebase:ProjectId", "sacou-test-project");
            builder.UseSetting("ConnectionStrings:Sacou", "Host=127.0.0.1;Port=1;Database=sacou;Username=sacou;Timeout=2");
            builder.UseSetting("Database:MigrateOnStartup", "false");
        }
    }
}
