using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Sacou.Http.AppConfig;
using Xunit;

namespace Sacou.Http.Tests.AppConfig;

/// <summary>Cases 13 and 14 of the plan: the 426 of the minimum build and the 404 of a flag that is off (ADR 0084).</summary>
public sealed class AppConfigGatesTests
{
    private const int Minimum = 10;
    private const int Reached = 204;

    public static readonly TheoryData<string?, string?, bool> Headers = new()
    {
        { "android", "9", true },
        { "ANDROID", "9", true },
        { "android", "10", false },
        { "android", "11", false },
        { "ios", "9", true },
        { "ios", "10", false },
        { null, "1", false },
        { "android", null, false },
        { "windows", "1", false },
        { "android", "abc", false },
        { "android", "-1", false },
        { "android", "1.5", false },
        { "android", "99999999999999999999", false },
        { "android", "", false },
    };

    [Theory]
    [MemberData(nameof(Headers))]
    public async Task AppBuildGate_RefusesOnlyAKnownPlatformBelowTheMinimum(string? platform, string? build, bool outdated)
    {
        var context = await SendAsync("/v1/me", MinimumSettings(), platform, build);

        Assert.Equal(outdated ? 426 : Reached, context.Response.StatusCode);
        if (outdated)
        {
            Assert.Equal(AppConfigErrors.AppOutdatedCode, (await BodyAsync(context))[ProblemResults.CodeExtension]!.GetValue<string>());
        }
    }

    [Fact]
    public async Task AppBuildGate_WithAHugeOrRepeatedHeader_Passes()
    {
        var huge = await SendAsync("/v1/me", MinimumSettings(), "android", new string('1', 10_000));
        var context = NewContext("/v1/me", MinimumSettings());
        context.Request.Headers[AppBuildGate.PlatformHeader] = "android";
        context.Request.Headers[AppBuildGate.BuildHeader] = new Microsoft.Extensions.Primitives.StringValues(["1", "2"]);
        await Pipeline(context);

        Assert.Equal(Reached, huge.Response.StatusCode);
        Assert.Equal(Reached, context.Response.StatusCode);
    }

    [Theory]
    [InlineData("/health")]
    [InlineData("/v1/app-config")]
    [InlineData("/r/abc")]
    public async Task AppBuildGate_NeverGuardsHealthTheConfigOrThePages(string path)
    {
        var context = await SendAsync(path, MinimumSettings(), "android", "1");

        Assert.Equal(Reached, context.Response.StatusCode);
    }

    [Fact]
    public async Task FeatureGate_WithTheFlagOff_AnswersNotFoundWithItsCode()
    {
        var context = NewContext("/x", FeaturesSettings("false"), new FeatureRequirement(AppFeature.MvpVote));

        await Pipeline(context);

        Assert.Equal(404, context.Response.StatusCode);
        Assert.Equal(AppConfigErrors.FeatureDisabledCode, (await BodyAsync(context))[ProblemResults.CodeExtension]!.GetValue<string>());
    }

    [Theory]
    [InlineData("true")]
    [InlineData(null)]
    public async Task FeatureGate_WithTheFlagOnOrUnset_PassesTheRouteThrough(string? value)
    {
        var context = NewContext("/x", FeaturesSettings(value), new FeatureRequirement(AppFeature.MvpVote));

        await Pipeline(context);

        Assert.Equal(Reached, context.Response.StatusCode);
    }

    [Fact]
    public async Task FeatureGate_WithAnotherRouteAndTheFlagOff_PassesThrough()
    {
        var context = NewContext("/x", FeaturesSettings("false"));

        await Pipeline(context);

        Assert.Equal(Reached, context.Response.StatusCode);
    }

    private static Dictionary<string, string?> MinimumSettings() => new()
    {
        ["AppConfig:MinimumBuild:Android"] = Minimum.ToString(System.Globalization.CultureInfo.InvariantCulture),
        ["AppConfig:MinimumBuild:Ios"] = Minimum.ToString(System.Globalization.CultureInfo.InvariantCulture),
    };

    private static Dictionary<string, string?> FeaturesSettings(string? value)
    {
        var settings = new Dictionary<string, string?> { ["AppConfig:MinimumBuild:Android"] = "1", ["AppConfig:MinimumBuild:Ios"] = "1" };
        if (value is not null)
        {
            settings["AppConfig:Features:MvpVote"] = value;
        }

        return settings;
    }

    private static async Task<HttpContext> SendAsync(string path, Dictionary<string, string?> settings, string? platform, string? build)
    {
        var context = NewContext(path, settings);
        if (platform is not null)
        {
            context.Request.Headers[AppBuildGate.PlatformHeader] = platform;
        }

        if (build is not null)
        {
            context.Request.Headers[AppBuildGate.BuildHeader] = build;
        }

        await Pipeline(context);
        return context;
    }

    private static DefaultHttpContext NewContext(string path, Dictionary<string, string?> settings, params object[] metadata)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
        var services = new ServiceCollection().AddLogging().AddProblemDetails().AddSacouAppConfig(configuration).BuildServiceProvider();
        var context = new DefaultHttpContext { RequestServices = services };
        context.Request.Path = path;
        context.Response.Body = new MemoryStream();
        if (metadata.Length > 0)
        {
            context.SetEndpoint(new Endpoint(requestDelegate: null, new EndpointMetadataCollection(metadata), displayName: "test"));
        }

        return context;
    }

    private static Task Pipeline(HttpContext context)
    {
        var app = new ApplicationBuilder(context.RequestServices);
        app.UseSacouAppBuildGate();
        app.UseSacouFeatureGate();
        app.Run(reached =>
        {
            reached.Response.StatusCode = Reached;
            return Task.CompletedTask;
        });
        return app.Build()(context);
    }

    private static async Task<JsonNode> BodyAsync(HttpContext context)
    {
        context.Response.Body.Position = 0;
        return (await JsonNode.ParseAsync(context.Response.Body, cancellationToken: TestContext.Current.CancellationToken))!;
    }
}
