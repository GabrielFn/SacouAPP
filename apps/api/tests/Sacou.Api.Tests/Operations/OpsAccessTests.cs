using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Api.Tests.Operations;

/// <summary>
/// Criteria 3 and 4 of E7.2 (ADR 0085, D1): only a subject of the list gets the counts; anyone else signed in gets the
/// very 404 of a route that does not exist, and the log says only <c>ops.denied</c>.
/// </summary>
public sealed class OpsAccessTests
{
    private const string Operator = "uid-operador-abc";

    [Fact]
    public async Task AListedSubject_Gets200_NeverStored()
    {
        await using var host = new OpsHost(Operator);
        using var client = host.CreateClient();
        using var request = OpsHost.Get(Operator);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        Assert.Equal(1, host.Identity.Calls);
    }

    [Theory]
    [InlineData("uid-operador-abd")]
    [InlineData("UID-OPERADOR-ABC")]
    [InlineData("uid-operador-ab")]
    [InlineData("uid-operador-abcd")]
    public async Task AnotherSubject_GetsTheBodyOfAMissingRoute_AndOnlyOpsDeniedIsLogged(string subject)
    {
        await using var host = new OpsHost(Operator);
        using var client = host.CreateClient();
        using var request = OpsHost.Get(subject);
        using var missing = OpsHost.Get(subject, "/v1/ops/does-not-exist");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        using var control = await client.SendAsync(missing, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, control.StatusCode);
        Assert.Equal(await ShapeAsync(control), await ShapeAsync(response));
        Assert.Equal(control.Content.Headers.ContentType?.MediaType, response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(0, host.Identity.Calls);
        Assert.Contains(host.Logs.Entries, entry => entry.Contains("ops.denied", StringComparison.Ordinal));
        Assert.DoesNotContain(host.Logs.Entries, entry => entry.Contains(subject, StringComparison.Ordinal));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task AnEmptyList_LetsNobodyIn(string? operators)
    {
        await using var host = new OpsHost(operators);
        using var client = host.CreateClient();
        using var request = OpsHost.Get(Operator);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(0, host.Identity.Calls);
    }

    [Fact]
    public async Task TwoListedSubjects_BothGetIn()
    {
        await using var host = new OpsHost("uid-operador-abc, uid-operador-def");
        using var client = host.CreateClient();

        foreach (var subject in new[] { "uid-operador-abc", "uid-operador-def" })
        {
            using var request = OpsHost.Get(subject);
            using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }

    [Fact]
    public async Task NoToken_OrAnExpiredOne_Is401()
    {
        await using var host = new OpsHost(Operator);
        using var client = host.CreateClient();
        var now = FixedTimeProvider.WholeSecondNow();
        var expired = TestIdToken.Valid(OpsHost.Key, now.AddHours(-3))
            .With("sub", Operator).With("user_id", Operator).Sign();
        using var withExpired = new HttpRequestMessage(HttpMethod.Get, OpsHost.Route);
        withExpired.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", expired);
        using var anonymous = OpsHost.Get(subject: null);

        using var none = await client.SendAsync(anonymous, TestContext.Current.CancellationToken);
        using var old = await client.SendAsync(withExpired, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, none.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, old.StatusCode);
        Assert.Equal(0, host.Identity.Calls);
    }

    [Fact]
    public async Task AQuery_IsRefused_AndNeverCounts()
    {
        await using var host = new OpsHost(Operator);
        using var client = host.CreateClient();
        using var request = OpsHost.Get(Operator, OpsHost.Route + "?group=x");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, host.Identity.Calls);
    }

    [Fact]
    public async Task TheRoute_TakesTheOperatorPolicy_AndIsOutOfTheAppContract()
    {
        await using var host = new OpsHost(Operator);

        var endpoint = host.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .Single(candidate => candidate.RoutePattern.RawText == OpsHost.Route);

        Assert.Null(endpoint.Metadata.GetMetadata<IAllowAnonymous>());
        Assert.Equal("operator-only", Assert.Single(endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>()).Policy);
        Assert.NotNull(endpoint.Metadata.GetMetadata<IExcludeFromDescriptionMetadata>());
        Assert.Equal(["GET"], endpoint.Metadata.GetRequiredMetadata<HttpMethodMetadata>().HttpMethods);
    }

    /// <summary>The database out of reach (the closed port of the test factory): 503, and the log has only the exception's type.</summary>
    [Fact]
    public async Task ADatabaseOutOfReach_Is503()
    {
        await using var host = new OpsHost(Operator, realMetrics: true);
        using var client = host.CreateClient();
        using var request = OpsHost.Get(Operator);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        Assert.Contains(host.Logs.Entries, entry => entry.Contains("ops.unavailable: NpgsqlException.", StringComparison.Ordinal));
    }

    /// <summary>The body without the trace id, which differs on every request.</summary>
    private static async Task<string> ShapeAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        using var body = JsonDocument.Parse(text);
        return string.Join(
            ";",
            body.RootElement.EnumerateObject().Where(property => property.Name != "traceId").Select(property => $"{property.Name}={property.Value}"));
    }
}
