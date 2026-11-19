using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Sacou.Modules.Sessions.RoundLinks;

/// <summary>
/// <c>RoundPage:PublicBaseUrl</c>: the origin the round's public page answers on (ADR 0070, D1), such as the Cloud Run
/// host now and the bought domain later. The API builds the link, never the app: changing the domain is a setting,
/// without a new build of the app.
/// </summary>
internal sealed class RoundPageOptions
{
    public const string SectionName = "RoundPage";

    public string? PublicBaseUrl { get; init; }

    /// <summary>The origin, or null when the setting is empty (only allowed in Development, where no link is shared).</summary>
    public Uri? BaseUri => string.IsNullOrWhiteSpace(PublicBaseUrl) ? null : new Uri(PublicBaseUrl, UriKind.Absolute);
}

/// <summary>
/// Required outside Development; when present, an <c>https</c> origin with no path, query, fragment or user. Runs on start
/// (<c>ValidateOnStart</c>). The message names the key and never the value.
/// </summary>
internal sealed class RoundPageOptionsValidator(IHostEnvironment environment) : IValidateOptions<RoundPageOptions>
{
    private const string Key = RoundPageOptions.SectionName + ":" + nameof(RoundPageOptions.PublicBaseUrl);
    private const string RootPath = "/";

    public ValidateOptionsResult Validate(string? name, RoundPageOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        if (string.IsNullOrWhiteSpace(options.PublicBaseUrl))
        {
            return environment.IsDevelopment()
                ? ValidateOptionsResult.Success
                : ValidateOptionsResult.Fail($"{Key} is required outside Development.");
        }

        return IsHttpsOrigin(options.PublicBaseUrl)
            ? ValidateOptionsResult.Success
            : ValidateOptionsResult.Fail($"{Key} must be an https origin, without a path, a query, a fragment or a user.");
    }

    /// <summary>The text is checked too: an empty <c>?</c> or <c>#</c> leaves no query nor fragment on the parsed URI.</summary>
    private static bool IsHttpsOrigin(string text) =>
        Uri.TryCreate(text, UriKind.Absolute, out var uri)
        && uri.Scheme == Uri.UriSchemeHttps
        && uri.AbsolutePath == RootPath
        && uri.UserInfo.Length == 0
        && text.IndexOfAny(['?', '#']) < 0;
}
