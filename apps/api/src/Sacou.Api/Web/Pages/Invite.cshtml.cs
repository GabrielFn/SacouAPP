using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Options;

namespace Sacou.Api.Web.Pages;

/// <summary>
/// <c>GET /c</c>, the invite page (E3.12 Part 3, ADR 0070, D8; ADR 0040, D10): a shell with no data of the server.
/// The token stays after the <c>#</c>, which no browser sends; the script reads it, clears it from the address and sends
/// it only in the body of <c>POST /v1/invites/preview</c> and <c>/accept</c>. GET only, nothing written, the same
/// headers and CSP as <c>/r/{code}</c>. The WhatsApp preview is the Sacou's own (the robot never sees the token).
/// </summary>
internal sealed class InviteModel(IWebAssets assets, IOptions<FirebaseWebOptions> firebase, IOptions<WebPageOptions> page) : PageModel
{
    public const string PagePath = "/c";

    public WebEntry? Assets => assets.Invite;

    /// <summary>The Firebase Web config when complete; without it the page cannot sign in and says so.</summary>
    public FirebaseWebOptions? Firebase => firebase.Value.IsComplete ? firebase.Value : null;

    public SignInSheetView SignInSheet => new(
        Context: null,
        WebTexts.InviteSheetTitle,
        WebTexts.InviteSheetBody,
        Privacy: null,
        SignInSheetView.HttpsOrNull(page.Value.TermsUrl),
        SignInSheetView.HttpsOrNull(page.Value.PrivacyUrl));

    /// <summary>The page's own address, never with the token (the server never has it).</summary>
    public string PageUrl => Origin + PagePath;

    public string PreviewImageUrl => Origin + RoundModel.PreviewImagePath;

    private string Origin => SignInSheetView.HttpsOrNull(page.Value.PublicBaseUrl)?.GetLeftPart(UriPartial.Authority)
        ?? $"{Request.Scheme}://{Request.Host}";
}
