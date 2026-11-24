using Sacou.Shared.Results;

namespace Sacou.Http.AppConfig;

/// <summary>The codes of the two answers of the app-config gates (ADR 0084). Listed in the contract with the pipeline's codes.</summary>
public static class AppConfigErrors
{
    /// <summary>The 426: the app's native build is below the minimum.</summary>
    public const string AppOutdatedCode = "api.app-outdated";

    /// <summary>The 404 of a route whose feature flag is off.</summary>
    public const string FeatureDisabledCode = "api.feature-disabled";

    public static readonly Error FeatureDisabled = new(FeatureDisabledCode, ErrorKind.NotFound);
}
