using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Options;
using Sacou.Modules.Sessions.Contracts;
using Sacou.Shared.Text;

namespace Sacou.Api.Web.Pages;

/// <summary>
/// <c>GET /r/{code}</c>, screen 01 (E3.12, ADR 0070, D5): the public summary of the round, its WhatsApp preview and the
/// login sheet of screen 02. GET only (no handler for any other method, so no form posts here and no antiforgery cookie);
/// nothing written. A malformed code and one of no round give the same 404 page, without echoing the code.
/// </summary>
internal sealed class RoundModel(
    IPublicRoundSummary summaries,
    IWebAssets assets,
    IOptions<FirebaseWebOptions> firebase,
    IOptions<WebPageOptions> page) : PageModel
{
    public const string PagePath = "/r/";
    public const string PreviewImagePath = "/brand/og-image.png";

    public RoundPageView? Round { get; private set; }

    /// <summary>The code, only once it found a round: the 404 never shows what was typed.</summary>
    public string? Code { get; private set; }

    public WebEntry? Assets => assets.Round;

    /// <summary>The Firebase Web config when complete; without it the page has no VOU (read-only).</summary>
    public FirebaseWebOptions? Firebase => firebase.Value.IsComplete ? firebase.Value : null;

    public static int NicknameMaxLength => PersonName.MaxLength;

    public SignInSheetView SignInSheet => new(
        Round?.When,
        WebTexts.SheetTitle,
        WebTexts.SheetBody,
        WebTexts.Privacy);

    public string PageUrl => Origin + PagePath + Code;

    public string PreviewImageUrl => Origin + PreviewImagePath;

    /// <summary>The public origin of the configuration; on a developer machine without it, the request's own.</summary>
    private string Origin => SignInSheetView.HttpsOrNull(page.Value.PublicBaseUrl)?.GetLeftPart(UriPartial.Authority)
        ?? $"{Request.Scheme}://{Request.Host}";

    public async Task<IActionResult> OnGetAsync(string? code, CancellationToken cancellationToken)
    {
        var summary = await summaries.FindByCodeAsync(code, cancellationToken).ConfigureAwait(false);
        if (summary is null)
        {
            Response.StatusCode = StatusCodes.Status404NotFound;
            return Page();
        }

        Round = RoundPageView.From(summary);
        Code = code;
        return Page();
    }
}
