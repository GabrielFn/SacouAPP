using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Options;

namespace Sacou.Api.Web.Pages;

/// <summary>
/// <c>GET /painel</c>, the operator's dashboard (E7.2, ADR 0085): a shell with no data of the server, like <c>/c</c>. The
/// script signs in with Firebase and asks <c>GET /v1/ops/metrics</c>, which answers only the listed UIDs. GET only,
/// nothing written, the headers and the CSP of <c>/r/{code}</c>; the query is never read.
/// </summary>
internal sealed class OpsModel(IWebAssets assets, IOptions<FirebaseWebOptions> firebase) : PageModel
{
    public const string PagePath = "/painel";

    public WebEntry? Assets => assets.Ops;

    /// <summary>The Firebase Web config when complete; without it the page cannot sign in and says so.</summary>
    public FirebaseWebOptions? Firebase => firebase.Value.IsComplete ? firebase.Value : null;

    public SignInSheetView SignInSheet { get; } = new(
        Context: null,
        WebTexts.OpsSheetTitle,
        WebTexts.OpsSheetBody,
        Privacy: null);
}
