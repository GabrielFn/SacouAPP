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
    /// <summary>The block index the request block follows when the section is missing: before every block.</summary>
    public const int BeforeTheText = -1;

    public string VersionLine => WebTexts.LegalVersion(Document.Version, Document.UpdatedOn);

    /// <summary>
    /// The index of the last block of the section "Sem o app", after which the request block is drawn. Without that
    /// section, <see cref="BeforeTheText"/>: the channel never disappears because a heading changed.
    /// </summary>
    public int DeletionRequestAfter => LastBlockOf(WebTexts.DeletionRequestSection);

    private int LastBlockOf(string section)
    {
        var blocks = Document.Blocks;
        var start = Enumerable.Range(0, blocks.Count).FirstOrDefault(index => IsSection(blocks[index], section), BeforeTheText);
        if (start == BeforeTheText)
        {
            return BeforeTheText;
        }

        var next = Enumerable.Range(start + 1, blocks.Count - start - 1).FirstOrDefault(index => IsSection(blocks[index]), blocks.Count);
        return next - 1;
    }

    private static bool IsSection(LegalBlock block, string? text = null) =>
        block is LegalBlock.Heading { Level: LegalDocumentParser.SectionLevel } heading
        && (text is null || string.Equals(heading.Text, text, StringComparison.Ordinal));
}

/// <summary>
/// The "Sem o app" block (E6.4): the data protection contact from the settings, or null while it does not exist
/// (question 250), when the block says the e-mail channel is not available yet. Nothing here comes from the request.
/// </summary>
internal sealed record DeletionRequestView(string? Email)
{
    public string? MailTo => Email is null ? null : "mailto:" + Email + "?subject=" + WebTexts.DeletionRequestSubject;
}
