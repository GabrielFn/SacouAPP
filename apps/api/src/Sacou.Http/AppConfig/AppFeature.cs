using System.Collections.Frozen;

namespace Sacou.Http.AppConfig;

/// <summary>The closed list of the feature flags (ADR 0084). A new flag is a new member here, never a free string.</summary>
public enum AppFeature
{
    /// <summary>The MVP vote of the round (E3.18, ADR 0072).</summary>
    MvpVote,
}

/// <summary>The name of each flag in the configuration, and its default when the configuration is silent.</summary>
public static class AppFeatures
{
    /// <summary>A flag nobody wrote is on: the app and the API ship with every feature, and the list only turns one off.</summary>
    public const bool DefaultValue = true;

    private static readonly FrozenDictionary<AppFeature, string> Names = new Dictionary<AppFeature, string>
    {
        [AppFeature.MvpVote] = "MvpVote",
    }.ToFrozenDictionary();

    public static string NameOf(AppFeature flag) =>
        Names.TryGetValue(flag, out var name) ? name : throw new ArgumentOutOfRangeException(nameof(flag), flag, "Every flag needs a name.");

    public static bool IsKnown(string name) => Names.Values.Contains(name, StringComparer.Ordinal);
}
