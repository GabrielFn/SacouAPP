using Microsoft.AspNetCore.Mvc.RazorPages;
using Sacou.Api.Web.Legal;

namespace Sacou.Api.Web.Pages;

/// <summary>
/// <c>GET /privacidade</c>: the privacy policy (E6.1, ADR 0083), read from <c>docs/legal/politica-de-privacidade.md</c>
/// at build time. Anonymous, GET only, nothing read from the request: the same text for everyone, no script.
/// </summary>
internal sealed class PrivacyModel(ILegalDocuments documents, IWebAssets assets) : PageModel
{
    public const string PagePath = "/privacidade";

    public LegalPageView View => new(documents.Privacy, assets.LegalStyle, WebTexts.TermsOfUse, TermsModel.PagePath);
}
