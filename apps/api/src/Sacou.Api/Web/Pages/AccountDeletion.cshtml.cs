using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Options;
using Sacou.Api.Web.Legal;

namespace Sacou.Api.Web.Pages;

/// <summary>
/// <c>GET /excluir-conta</c>: how to delete the account, with or without the app (E6.4, the Play's web link), read from
/// <c>docs/legal/exclusao-de-conta.md</c> at build time, with the data protection contact of the settings. Anonymous,
/// GET only, nothing read from the request.
/// </summary>
internal sealed class AccountDeletionModel(ILegalDocuments documents, IWebAssets assets, IOptions<DataProtectionOptions> options)
    : PageModel
{
    public const string PagePath = "/excluir-conta";

    public LegalPageView View => new(
        documents.AccountDeletion,
        assets.LegalStyle,
        WebTexts.PrivacyPolicy,
        PrivacyModel.PagePath,
        new DeletionRequestView(options.Value.NormalizedContactEmail));
}
