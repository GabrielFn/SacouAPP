using Microsoft.Extensions.Options;

namespace Sacou.Http.RateLimiting;

/// <summary>Every window present, every number above zero (ADR 0062, D6). Runs on start, through <c>ValidateOnStart</c>.</summary>
internal sealed class RateLimitingOptionsValidator : IValidateOptions<RateLimitingOptions>
{
    private const int Minimum = 1;

    public ValidateOptionsResult Validate(string? name, RateLimitingOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        var failures = options.Windows().SelectMany(window => WindowFailures(window.Key, window.Value))
            .Concat(CountFailure(nameof(options.DualConnectionConcurrency), options.DualConnectionConcurrency))
            .Concat(CountFailure(nameof(options.DualConnectionQueue), options.DualConnectionQueue))
            .Concat(CountFailure(nameof(options.DualConnectionHeadroom), options.DualConnectionHeadroom))
            .Concat(CountFailure(nameof(options.DualConnectionPerUser), options.DualConnectionPerUser))
            .Concat(CountFailure(nameof(options.DualConnectionPerUserQueue), options.DualConnectionPerUserQueue))
            .ToList();
        return failures.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(failures);
    }

    private static IEnumerable<string> WindowFailures(string policy, WindowLimitOptions? window)
    {
        if (window is null)
        {
            return [$"The rate limit '{policy}' is missing from {RateLimitingOptions.SectionName}."];
        }

        return CountFailure($"{policy}.{nameof(window.PermitLimit)}", window.PermitLimit)
            .Concat(CountFailure($"{policy}.{nameof(window.WindowSeconds)}", window.WindowSeconds));
    }

    private static IEnumerable<string> CountFailure(string setting, int value) =>
        value < Minimum ? [$"{RateLimitingOptions.SectionName}:{setting} must be at least {Minimum}."] : [];
}
