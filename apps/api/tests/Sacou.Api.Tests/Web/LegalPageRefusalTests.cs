using System.Net;
using Xunit;

namespace Sacou.Api.Tests.Web;

/// <summary>E6.1 tester: pins the exact refusal of the paths and methods the legal pages do not serve.</summary>
public sealed class LegalPageRefusalTests(SacouApiFactory factory) : IClassFixture<SacouApiFactory>
{
    [Theory]
    [InlineData("/termos/x")]
    [InlineData("/privacidade/x")]
    [InlineData("/excluir-conta/x")]
    [InlineData("/AccountDeletion")]
    public async Task PathBelowAPage_IsExactly401(string path)
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("/termos")]
    [InlineData("/privacidade")]
    [InlineData("/excluir-conta")]
    public async Task Post_IsExactly401(string path)
    {
        using var client = factory.CreateClient();
        using var content = new StringContent("x=1");

        using var response = await client.PostAsync(new Uri(path, UriKind.Relative), content, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
