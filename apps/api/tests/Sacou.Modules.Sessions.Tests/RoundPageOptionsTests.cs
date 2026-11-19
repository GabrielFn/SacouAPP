using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Sacou.Modules.Sessions.RoundLinks;
using Xunit;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>Case 21 of the E3.12 plan: <c>RoundPage:PublicBaseUrl</c> is an https origin, required outside Development.</summary>
public sealed class RoundPageOptionsTests
{
    [Theory]
    [InlineData("https://sacou.app")]
    [InlineData("https://sacou.app/")]
    [InlineData("https://sacou-api-abc123.us-east4.run.app")]
    public void HttpsOrigin_IsAccepted(string url)
    {
        Assert.True(Validate("Production", url).Succeeded);
    }

    [Theory]
    [InlineData("http://sacou.app")]
    [InlineData("https://sacou.app/r")]
    [InlineData("https://sacou.app/?x=1")]
    [InlineData("https://sacou.app?")]
    [InlineData("https://sacou.app/#top")]
    [InlineData("https://user:pass@sacou.app")]
    [InlineData("sacou.app")]
    [InlineData("ftp://sacou.app")]
    public void AnythingButAnOrigin_IsRefused_WithoutEchoingTheValue(string url)
    {
        var result = Validate("Development", url);

        Assert.True(result.Failed);
        Assert.Contains("RoundPage:PublicBaseUrl", result.FailureMessage, StringComparison.Ordinal);
        Assert.DoesNotContain(url, result.FailureMessage, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("Production", false)]
    [InlineData("Staging", false)]
    [InlineData("Development", true)]
    public void Empty_IsOnlyAllowedInDevelopment(string environment, bool allowed)
    {
        Assert.Equal(allowed, Validate(environment, "").Succeeded);
        Assert.Equal(allowed, Validate(environment, null).Succeeded);
    }

    private static Microsoft.Extensions.Options.ValidateOptionsResult Validate(string environment, string? url) =>
        new RoundPageOptionsValidator(new Environment(environment)).Validate(null, new RoundPageOptions { PublicBaseUrl = url });

    private sealed class Environment(string name) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = name;

        public string ApplicationName { get; set; } = "Sacou.Api";

        public string ContentRootPath { get; set; } = "";

        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
