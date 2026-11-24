using Sacou.Api.Web.Pages;
using Sacou.Shared.Text;

namespace Sacou.Api.Web;

/// <summary>
/// The sheet of screen 02 as each page opens it (ADR 0070, D4 and D8): the line above the title (the round's day, or
/// none), the first title and body and the privacy line (the round page's nicknames). The legal links are this host's
/// own pages, on the same origin (E6.1, ADR 0083).
/// </summary>
internal sealed record SignInSheetView(string? Context, string Title, string Body, string? Privacy)
{
    public static int NicknameMaxLength => PersonName.MaxLength;

    public static string TermsPath => TermsModel.PagePath;

    public static string PrivacyPath => PrivacyModel.PagePath;

    /// <summary>An absolute <c>https</c> address of the configuration, or null.</summary>
    public static Uri? HttpsOrNull(string? value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps ? uri : null;
}
