namespace Sacou.Http.AppConfig;

/// <summary>The store platforms of the app. The app names itself with these two words in <c>X-Sacou-App-Platform</c>.</summary>
public static class AppPlatforms
{
    public const string Android = "android";
    public const string Ios = "ios";
}

/// <summary>One build number per platform of the app.</summary>
public sealed class PlatformBuildOptions
{
    public int Android { get; init; }

    public int Ios { get; init; }

    /// <summary>The number of a platform by its lower-case name; <c>null</c> for a platform the app never sends.</summary>
    public int? Of(string platform) => platform switch
    {
        AppPlatforms.Android => Android,
        AppPlatforms.Ios => Ios,
        _ => null,
    };
}

/// <summary>The store page of each platform; empty when there is none yet (the screen then has no button).</summary>
public sealed class PlatformUrlOptions
{
    public string Android { get; init; } = string.Empty;

    public string Ios { get; init; } = string.Empty;
}

/// <summary>
/// The <c>AppConfig</c> section (ADR 0084): the oldest native build the API still serves, per platform, the store pages and
/// the feature flags of this environment. Changed by a pull request on the appsettings; never a secret, never a person's data.
/// </summary>
public sealed class AppConfigOptions
{
    public const string SectionName = "AppConfig";

    public PlatformBuildOptions MinimumBuild { get; init; } = new();

    public PlatformUrlOptions UpdateUrl { get; init; } = new();

    /// <summary>Flag name to <c>true</c> or <c>false</c>, as text, so a typo in the value is refused on start. A missing flag has its default.</summary>
    public Dictionary<string, string?> Features { get; init; } = new(StringComparer.Ordinal);

    /// <summary>Valid only after the start-up validation: the text is then known to be a boolean.</summary>
    public bool IsOn(AppFeature flag) =>
        Features.TryGetValue(AppFeatures.NameOf(flag), out var text) && bool.TryParse(text, out var value) ? value : AppFeatures.DefaultValue;
}
