using Microsoft.Extensions.Options;

namespace Sacou.Http.AppConfig;

/// <summary>Builds from 1, store pages over HTTPS or empty, only known flags with a boolean value. Runs on start (ADR 0084).</summary>
internal sealed class AppConfigOptionsValidator : IValidateOptions<AppConfigOptions>
{
    private const int FirstBuild = 1;

    public ValidateOptionsResult Validate(string? name, AppConfigOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        var failures = BuildFailure("MinimumBuild:" + nameof(options.MinimumBuild.Android), options.MinimumBuild.Android)
            .Concat(BuildFailure("MinimumBuild:" + nameof(options.MinimumBuild.Ios), options.MinimumBuild.Ios))
            .Concat(UrlFailure("UpdateUrl:" + nameof(options.UpdateUrl.Android), options.UpdateUrl.Android))
            .Concat(UrlFailure("UpdateUrl:" + nameof(options.UpdateUrl.Ios), options.UpdateUrl.Ios))
            .Concat(options.Features.SelectMany(flag => FlagFailure(flag.Key, flag.Value)))
            .ToList();
        return failures.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(failures);
    }

    private static IEnumerable<string> BuildFailure(string setting, int value) =>
        value < FirstBuild ? [$"{AppConfigOptions.SectionName}:{setting} must be at least {FirstBuild}."] : [];

    private static IEnumerable<string> UrlFailure(string setting, string value) =>
        value.Length == 0 || (Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps)
            ? []
            : [$"{AppConfigOptions.SectionName}:{setting} must be empty or an HTTPS address."];

    private static IEnumerable<string> FlagFailure(string flag, string? value)
    {
        if (!AppFeatures.IsKnown(flag))
        {
            return [$"{AppConfigOptions.SectionName}:Features has an unknown flag."];
        }

        return bool.TryParse(value, out _) ? [] : [$"{AppConfigOptions.SectionName}:Features:{flag} must be true or false."];
    }
}
