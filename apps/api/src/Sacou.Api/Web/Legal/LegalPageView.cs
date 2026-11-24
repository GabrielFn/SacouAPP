namespace Sacou.Api.Web.Legal;

/// <summary>What the legal page draws: the document, its built style (null without the build) and the link to the other text.</summary>
internal sealed record LegalPageView(LegalDocument Document, string? Style, string OtherTitle, string OtherPath)
{
    public string VersionLine => WebTexts.LegalVersion(Document.Version, Document.UpdatedOn);
}
