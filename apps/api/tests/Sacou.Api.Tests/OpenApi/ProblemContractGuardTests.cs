using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Sacou.Api.Tests.OpenApi;

/// <summary>C7: the guard on the real API, then on planted routes (an untested rule proves nothing).</summary>
public sealed class ProblemContractGuardTests
{
    [Fact]
    public async Task RealApi_EveryProblemIsDeclared()
    {
        await using var factory = new SacouApiFactory();

        Assert.Empty(ProblemContractGuard.Violations(factory.Services.GetRequiredService<EndpointDataSource>().Endpoints));
    }

    [Fact]
    public void ProblemWithoutProducesProblem_IsReported()
    {
        var app = PlantedApp();
        app.MapGet("/planted", Refuse);

        Assert.Single(ProblemContractGuard.Violations(Endpoints(app)));
    }

    [Fact]
    public void ProblemWithProducesProblem_IsNotReported()
    {
        var app = PlantedApp();
        app.MapGet("/planted", Refuse).ProducesProblem(StatusCodes.Status409Conflict);

        Assert.Empty(ProblemContractGuard.Violations(Endpoints(app)));
    }

    [Fact]
    public void GroupRouteWithoutProducesProblem_IsReported()
    {
        var app = PlantedApp();
        app.MapGet("/v1/groups/{groupId:guid}/planted", () => TypedResults.Ok());

        Assert.Single(ProblemContractGuard.Violations(Endpoints(app)));
    }

    [Fact]
    public void RouteWithoutProblem_IsNotReported()
    {
        var app = PlantedApp();
        app.MapGet("/planted", () => TypedResults.Ok());

        Assert.Empty(ProblemContractGuard.Violations(Endpoints(app)));
    }

    private static Results<Ok, ProblemHttpResult> Refuse() => TypedResults.Problem(statusCode: StatusCodes.Status409Conflict);

    private static WebApplication PlantedApp() => WebApplication.CreateBuilder().Build();

    private static IEnumerable<Endpoint> Endpoints(WebApplication app) =>
        ((IEndpointRouteBuilder)app).DataSources.SelectMany(source => source.Endpoints);
}
