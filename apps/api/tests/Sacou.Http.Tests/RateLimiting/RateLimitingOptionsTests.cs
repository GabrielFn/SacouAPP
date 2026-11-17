using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Sacou.Http.RateLimiting;
using Xunit;

namespace Sacou.Http.Tests.RateLimiting;

/// <summary>Case 1 of the plan: a missing window or a number below one stops the start (ADR 0062, D6).</summary>
public sealed class RateLimitingOptionsTests
{
    private const string Section = RateLimitingOptions.SectionName;

    [Fact]
    public void CompleteSection_IsValid()
    {
        var options = Resolve(RateLimitSettings.Complete());

        Assert.Equal(3, options.Draw!.PermitLimit);
        Assert.Equal(TimeSpan.FromSeconds(60), options.Draw.Window);
    }

    /// <summary>Every policy name has a window in the options, so none is configured by accident.</summary>
    [Fact]
    public void EveryPolicy_HasAWindow()
    {
        var policies = typeof(RateLimitPolicies).GetFields()
            .Where(field => field.IsLiteral)
            .Select(field => (string)field.GetRawConstantValue()!)
            .Order(StringComparer.Ordinal);

        Assert.Equal(policies, new RateLimitingOptions().Windows().Keys.Order(StringComparer.Ordinal));
    }

    [Theory]
    [InlineData("Draw:PermitLimit", "0")]
    [InlineData("SignIn:PermitLimit", "-1")]
    [InlineData("Global:WindowSeconds", "0")]
    [InlineData("DualConnectionConcurrency", "0")]
    [InlineData("DualConnectionQueue", "0")]
    [InlineData("DualConnectionHeadroom", "-2")]
    public void NumberBelowOne_FailsTheStart(string setting, string value)
    {
        var settings = RateLimitSettings.Complete();
        settings[$"{Section}:{setting}"] = value;

        var failure = Assert.Throws<OptionsValidationException>(() => Resolve(settings));

        Assert.Contains(failure.Failures, message => message.Contains(setting.Split(':')[^1], StringComparison.Ordinal));
    }

    [Fact]
    public void MissingPolicy_FailsTheStart()
    {
        var settings = RateLimitSettings.Complete();
        settings.Remove($"{Section}:CourtSync:PermitLimit");
        settings.Remove($"{Section}:CourtSync:WindowSeconds");

        var failure = Assert.Throws<OptionsValidationException>(() => Resolve(settings));

        Assert.Contains(failure.Failures, message => message.Contains(RateLimitPolicies.CourtSync, StringComparison.Ordinal));
    }

    [Fact]
    public void MissingSection_FailsTheStart()
    {
        Assert.Throws<OptionsValidationException>(() => Resolve(new Dictionary<string, string?>()));
    }

    private static RateLimitingOptions Resolve(IReadOnlyDictionary<string, string?> settings)
    {
        using var services = new ServiceCollection().AddSacouRateLimiting(RateLimitSettings.Build(settings)).BuildServiceProvider();
        return services.GetRequiredService<IOptions<RateLimitingOptions>>().Value;
    }
}
