namespace Sacou.Api.Web.Legal;

/// <summary>
/// What the legal page draws: the document, its built style (null without the build), the link to the other text and,
/// on <c>/excluir-conta</c> only, the block to ask without the app (E6.4).
/// </summary>
internal sealed record LegalPageView(
    LegalDocument Document,
    string? Style,
    string OtherTitle,
    string OtherPath,
    DeletionRequestView? DeletionRequest = null)
{
    public string VersionLine => WebTexts.LegalVersion(Document.Version, Document.UpdatedOn);
}

/// <summary>
/// The "Pedir sem o app" block (E6.4): the data protection contact from the settings, or null while it does not exist
/// (question 250), when the block says the e-mail channel is not available yet. Nothing here comes from the request.
/// </summary>
internal sealed record DeletionRequestView(string? Email)
{
    public string? MailTo => Email is null ? null : "mailto:" + Email + "?subject=" + WebTexts.DeletionRequestSubject;
}
