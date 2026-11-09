using System.Text.RegularExpressions;

namespace Sacou.Modules.Identity.Authentication;

/// <summary>
/// The Firebase project the API trusts. Public configuration, not a secret: it ships inside the app.
/// It sets the expected <c>aud</c> and <c>iss</c> of every ID token (ADR 0036, D8).
/// </summary>
internal sealed partial class FirebaseProjectOptions
{
    public const string SectionName = "Firebase";
    public const string ProjectIdKey = SectionName + ":" + nameof(ProjectId);

    /// <summary>Names the key, never the value.</summary>
    public const string InvalidProjectIdMessage =
        ProjectIdKey + " must be a Google Cloud project ID (lowercase letters, digits and hyphens, 6 to 30 characters).";

    private const string IssuerPrefix = "https://securetoken.google.com/";

    public string ProjectId { get; set; } = string.Empty;

    public string Issuer => IssuerPrefix + ProjectId;

    public static bool IsValidProjectId(string? projectId) =>
        projectId is not null && ProjectIdPattern().IsMatch(projectId);

    [GeneratedRegex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", RegexOptions.CultureInvariant)]
    private static partial Regex ProjectIdPattern();
}
