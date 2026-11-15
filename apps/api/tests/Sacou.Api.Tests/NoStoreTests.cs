using System.Net;
using Xunit;

namespace Sacou.Api.Tests;

/// <summary>The no-store of the draw route covers the 401 of the authentication too, before any module code (ADR 0055).</summary>
public sealed class NoStoreTests(SacouApiFactory factory) : IClassFixture<SacouApiFactory>
{
    private const string DrawPath = "/v1/groups/00000000-0000-0000-0000-000000000001/rounds/00000000-0000-0000-0000-000000000002/draw";

    [Fact]
    public async Task Draw_WithoutAToken_Is401_AndNoStore()
    {
        using var client = factory.CreateClient();
        using var content = new StringContent("{}", System.Text.Encoding.UTF8, "application/json");

        using var response = await client.PostAsync(new Uri(DrawPath, UriKind.Relative), content, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task Health_HasNoNoStore()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/health", UriKind.Relative), TestContext.Current.CancellationToken);

        Assert.Null(response.Headers.CacheControl);
    }
}
