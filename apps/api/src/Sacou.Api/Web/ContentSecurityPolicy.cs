using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;

namespace Sacou.Api.Web;

/// <summary>
/// <c>WebSecurity</c>: the hosts of Google and Firebase the round page's login needs (ADR 0070, D5). Configuration, not
/// code, because the phone spike (step 1 of E3.12 Part 2) confirms the exact list: the values in <c>appsettings.json</c>
/// are the plan's starting point. Each item is one <c>https</c> origin; a wildcard or a keyword stops the start.
/// </summary>
internal sealed class WebSecurityOptions
{
    public const string SectionName = "WebSecurity";

    public IReadOnlyList<string> ScriptSources { get; init; } = [];

    public IReadOnlyList<string> ConnectSources { get; init; } = [];

    public IReadOnlyList<string> FrameSources { get; init; } = [];
}

internal sealed partial class WebSecurityOptionsValidator : IValidateOptions<WebSecurityOptions>
{
    public ValidateOptionsResult Validate(string? name, WebSecurityOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        var failures = new[]
            {
                (nameof(options.ScriptSources), options.ScriptSources),
                (nameof(options.ConnectSources), options.ConnectSources),
                (nameof(options.FrameSources), options.FrameSources),
            }
            .Where(list => list.Item2.Any(source => !IsHttpsOrigin(source)))
            .Select(list => $"{WebSecurityOptions.SectionName}:{list.Item1} accepts only https origins, without a wildcard.")
            .ToList();
        return failures.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(failures);
    }

    internal static bool IsHttpsOrigin(string source) => HttpsOrigin().IsMatch(source);

    [GeneratedRegex(@"^https://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$", RegexOptions.CultureInvariant)]
    private static partial Regex HttpsOrigin();
}

/// <summary>
/// The page's CSP, one string for every answer: no inline script and no inline style (the script reads its config from
/// <c>data-</c> attributes), only this host, and the Google and Firebase origins of the configuration. The Firebase
/// <c>authDomain</c> joins <c>frame-src</c> on its own: its iframe completes the Google sign-in.
/// </summary>
internal sealed class ContentSecurityPolicy(IOptions<WebSecurityOptions> security, IOptions<FirebaseWebOptions> firebase)
{
    private readonly Lazy<string> value = new(() => Build(security.Value, firebase.Value));

    public string Value => value.Value;

    internal static string Build(WebSecurityOptions security, FirebaseWebOptions firebase)
    {
        IEnumerable<string> authFrame = string.IsNullOrWhiteSpace(firebase.AuthDomain) ? [] : [$"https://{firebase.AuthDomain}"];
        string[] directives =
        [
            "default-src 'none'",
            Directive("script-src", ["'self'", .. security.ScriptSources]),
            "style-src 'self'",
            "img-src 'self' data:",
            "font-src 'self'",
            Directive("connect-src", ["'self'", .. security.ConnectSources]),
            Directive("frame-src", [.. authFrame, .. security.FrameSources]),
            "form-action 'none'",
            "base-uri 'none'",
            "object-src 'none'",
            "frame-ancestors 'none'",
        ];
        return string.Join("; ", directives.Where(directive => directive.Length > 0));
    }

    private static string Directive(string name, IReadOnlyCollection<string> sources) =>
        sources.Count == 0 ? $"{name} 'none'" : $"{name} {string.Join(' ', sources.Distinct(StringComparer.Ordinal))}";
}
