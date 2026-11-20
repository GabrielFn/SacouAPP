using Sacou.Shared.Text;

namespace Sacou.Api.Web;

/// <summary>
/// The sheet of screen 02 as each page opens it (ADR 0070, D4 and D8): the line above the title (the round's day, or
/// none), the first title and body, the privacy line (the round page's nicknames) and the legal links.
/// </summary>
internal sealed record SignInSheetView(string? Context, string Title, string Body, string? Privacy, Uri? TermsUrl, Uri? PrivacyUrl)
{
    public static int NicknameMaxLength => PersonName.MaxLength;

    /// <summary>An absolute <c>https</c> address of the configuration, or null (a link the page leaves out).</summary>
    public static Uri? HttpsOrNull(string? value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps ? uri : null;
}
