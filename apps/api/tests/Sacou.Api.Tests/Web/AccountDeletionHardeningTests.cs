using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Sacou.Api.Web;
using Xunit;

namespace Sacou.Api.Tests.Web;

/// <summary>E6.4 tester additions: markup characters in the local part, and the meta robots of the new page.</summary>
public sealed class AccountDeletionHardeningTests(SacouApiFactory factory) : IClassFixture<SacouApiFactory>
{
    [Theory]
    [InlineData("<a@b.c")]
    [InlineData("a<b@c.d")]
    [InlineData("a>b@c.d")]
    [InlineData("a\"b@c.d")]
    [InlineData("a'b@c.d")]
    [InlineData("a=b@c.d")]
    [InlineData("a;b@c.d")]
    [InlineData("a(b)@c.d")]
    public void MarkupCharacters_InTheLocalPart_AreRefused(string value)
    {
        var validator = new DataProtectionOptionsValidator(new FakeEnvironment());

        var result = validator.Validate(null, new DataProtectionOptions { ContactEmail = value });

        Assert.True(result.Failed);
        Assert.DoesNotContain(value, result.FailureMessage, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Page_HasTheMetaRobots_NoIndex()
    {
        await using var app = RoundPageFixture.Factory(factory, RoundPageFixture.One(RoundPageFixture.NineOfTwelve()));
        using var client = app.CreateClient();

        var html = await client.GetStringAsync(new Uri("/excluir-conta", UriKind.Relative), TestContext.Current.CancellationToken);

        Assert.Contains("<meta name=\"robots\" content=\"noindex, nofollow\">", html, StringComparison.Ordinal);
    }

    private sealed class FakeEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;

        public string ApplicationName { get; set; } = "Sacou.Api";

        public string ContentRootPath { get; set; } = "";

        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
