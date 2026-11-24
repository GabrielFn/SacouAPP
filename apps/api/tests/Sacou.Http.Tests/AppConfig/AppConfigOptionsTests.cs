using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Sacou.Http.AppConfig;
using Xunit;

namespace Sacou.Http.Tests.AppConfig;

/// <summary>Case 12 of the plan: the section stops the start on a value that would mislead the app (ADR 0084).</summary>
public sealed class AppConfigOptionsTests
{
    private static Dictionary<string, string?> Valid() => new()
    {
        ["AppConfig:MinimumBuild:Android"] = "1",
        ["AppConfig:MinimumBuild:Ios"] = "1",
        ["AppConfig:UpdateUrl:Android"] = "",
        ["AppConfig:UpdateUrl:Ios"] = "https://apps.apple.com/app/sacou",
        ["AppConfig:Features:MvpVote"] = "true",
    };

    [Fact]
    public void ValidSection_Starts()
    {
        var options = Resolve(Valid());

        Assert.True(options.IsOn(AppFeature.MvpVote));
    }

    [Theory]
    [InlineData("AppConfig:MinimumBuild:Android", "0", "MinimumBuild:Android")]
    [InlineData("AppConfig:MinimumBuild:Ios", "-3", "MinimumBuild:Ios")]
    [InlineData("AppConfig:UpdateUrl:Android", "http://play.google.com/store", "UpdateUrl:Android")]
    [InlineData("AppConfig:UpdateUrl:Ios", "javascript:alert(1)", "UpdateUrl:Ios")]
    [InlineData("AppConfig:Features:MvpVote", "maybe", "Features:MvpVote")]
    [InlineData("AppConfig:Features:Unknown", "true", "unknown flag")]
    public void InvalidValue_StopsTheStart(string key, string value, string expected)
    {
        var settings = Valid();
        settings[key] = value;

        var failure = Assert.Throws<OptionsValidationException>(() => Resolve(settings));

        Assert.Contains(expected, failure.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void MissingBuild_StopsTheStart()
    {
        Assert.Throws<OptionsValidationException>(() => Resolve([]));
    }

    [Fact]
    public void UnsetFlag_UsesTheCatalogDefault()
    {
        var settings = Valid();
        settings.Remove("AppConfig:Features:MvpVote");

        Assert.Equal(AppFeatures.DefaultValue, Resolve(settings).IsOn(AppFeature.MvpVote));
    }

    [Fact]
    public void FlagOff_IsOff()
    {
        var settings = Valid();
        settings["AppConfig:Features:MvpVote"] = "false";

        Assert.False(Resolve(settings).IsOn(AppFeature.MvpVote));
    }

    private static AppConfigOptions Resolve(Dictionary<string, string?> settings)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
        using var services = new ServiceCollection().AddSacouAppConfig(configuration).BuildServiceProvider();
        return services.GetRequiredService<IOptions<AppConfigOptions>>().Value;
    }
}
