using System.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Sacou.Modules.Identity.Contracts;
using Xunit;

namespace Sacou.Api.Tests;

/// <summary>
/// The internal pump route of E3.11 (ADR 0069, D11): outside the Firebase login and inside the service caller check,
/// out of the app's contract, and a 401 for a stranger or a person of the app.
/// </summary>
public sealed class InternalPumpRouteTests(SacouApiFactory factory) : IClassFixture<SacouApiFactory>
{
    private const string Route = "/internal/notifications/pump";

    [Fact]
    public void TheRoute_TakesOnlyTheServiceCallerPolicy()
    {
        var endpoint = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .Single(candidate => candidate.RoutePattern.RawText == Route);

        Assert.Null(endpoint.Metadata.GetMetadata<IAllowAnonymous>());
        var authorize = Assert.Single(endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>());
        Assert.Equal(ServiceCallers.Policy, authorize.Policy);
        Assert.Null(authorize.AuthenticationSchemes);
        Assert.NotNull(endpoint.Metadata.GetMetadata<IExcludeFromDescriptionMetadata>());
        Assert.Equal(["POST"], endpoint.Metadata.GetRequiredMetadata<HttpMethodMetadata>().HttpMethods);
    }

    [Fact]
    public async Task ThePolicy_ReadsOnlyTheServiceCallerScheme()
    {
        var policy = await factory.Services.GetRequiredService<IAuthorizationPolicyProvider>().GetPolicyAsync(ServiceCallers.Policy);

        Assert.Equal([ServiceCallers.AuthenticationScheme], policy!.AuthenticationSchemes);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("Bearer not-a-token")]
    [InlineData("Bearer a.b.c")]
    public async Task AStranger_Gets401(string? authorization)
    {
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, Route);
        if (authorization is not null)
        {
            request.Headers.TryAddWithoutValidation("Authorization", authorization);
        }

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
