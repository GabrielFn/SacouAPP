namespace Sacou.Api.Web;

/// <summary>
/// <c>Firebase:Web</c>: the public Web config of the Firebase project (not a secret: the browser needs it to sign in,
/// and the key is restricted by HTTP referrer). Handed to the script in <c>data-</c> attributes, never an inline script.
/// Empty (a machine without the Web app registered): the page is read-only, without VOU.
/// </summary>
internal sealed class FirebaseWebOptions
{
    public const string SectionName = "Firebase:Web";

    public string? ApiKey { get; init; }

    public string? AuthDomain { get; init; }

    public string? ProjectId { get; init; }

    public string? AppId { get; init; }

    public bool IsComplete =>
        !string.IsNullOrWhiteSpace(ApiKey) && !string.IsNullOrWhiteSpace(AuthDomain)
        && !string.IsNullOrWhiteSpace(ProjectId) && !string.IsNullOrWhiteSpace(AppId);
}

/// <summary>
/// What the page reads of <c>RoundPage</c>: the public origin (validated on start by the Sessions module, ADR 0070, D1)
/// for the absolute <c>og:url</c> and <c>og:image</c>. The legal links are this host's own pages (E6.1, ADR 0083).
/// </summary>
internal sealed class WebPageOptions
{
    public const string SectionName = "RoundPage";

    public string? PublicBaseUrl { get; init; }
}
