using Microsoft.AspNetCore.Mvc.RazorPages;
using Sacou.Api.Web.Legal;

namespace Sacou.Api.Web.Pages;

/// <summary>
/// <c>GET /termos</c>: the terms of use (E6.1, ADR 0083), read from <c>docs/legal/termos-de-uso.md</c> at build time.
/// Anonymous, GET only, nothing read from the request: the same text for everyone, no script.
/// </summary>
internal sealed class TermsModel(ILegalDocuments documents, IWebAssets assets) : PageModel
{
    public const string PagePath = "/termos";

    public LegalPageView View => new(documents.Terms, assets.LegalStyle, WebTexts.PrivacyPolicy, PrivacyModel.PagePath);
}
