using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Sacou.Api.Observability;
using Sentry.Extensibility;
using Sentry.AspNetCore;
using Xunit;

namespace Sacou.Api.Tests.Observability;

/// <summary>D3 and D5: the options that keep personal data out are pinned, as the real API builds them.</summary>
[Collection(SentrySequence.Name)]
public sealed class SentryFixedOptionsTests
{
    [Fact]
    public async Task SentryOptions_NeverSendPersonalDataOrTraces()
    {
        await using var api = new SentryTestApi("Production");

        var options = api.Factory.Services.GetRequiredService<IOptions<SentryAspNetCoreOptions>>().Value;

        Assert.False(options.SendDefaultPii);
        Assert.Equal(RequestSize.None, options.MaxRequestBodySize);
        Assert.Equal(0.0, options.TracesSampleRate);
        Assert.Equal(string.Empty, options.ServerName);
    }

    [Theory]
    [InlineData("Staging")]
    [InlineData("Production")]
    public async Task JsonFormatter_NeverIncludesScopes(string environment)
    {
        await using var factory = new SacouApiFactory { Environment = environment };

        var options = factory.Services.GetRequiredService<IOptionsMonitor<CloudRunJsonFormatterOptions>>().CurrentValue;

        Assert.False(options.IncludeScopes);
    }
}
