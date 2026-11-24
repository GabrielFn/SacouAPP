namespace Sacou.Api.Web.Legal;

/// <summary>
/// A legal text as the page draws it (E6.1, ADR 0083): the title, the version and the date of its top, and the blocks
/// of the published part. Plain text only: the page encodes every value, the reader never hands it HTML.
/// </summary>
internal sealed record LegalDocument(string Title, string Version, DateOnly UpdatedOn, IReadOnlyList<LegalBlock> Blocks);

/// <summary>The closed set of blocks the reader accepts: a heading of level 2 or 3, a paragraph, a list of items.</summary>
internal abstract record LegalBlock
{
    private LegalBlock()
    {
    }

    internal sealed record Heading(int Level, string Text) : LegalBlock;

    internal sealed record Paragraph(string Text) : LegalBlock;

    internal sealed record BulletList(IReadOnlyList<string> Items) : LegalBlock;
}

/// <summary>Why a legal text was refused, and on which line of the file (1-based); never the content of the line.</summary>
internal sealed record LegalParseError(string Reason, int Line);

/// <summary>The reader's Result: the document or the first problem found.</summary>
internal sealed class LegalParseResult
{
    private readonly LegalDocument? _document;
    private readonly LegalParseError? _error;

    private LegalParseResult(LegalDocument? document, LegalParseError? error)
    {
        _document = document;
        _error = error;
    }

    public bool IsSuccess => _error is null;

    public LegalDocument Document => _document ?? throw new InvalidOperationException("A failed result has no document.");

    public LegalParseError Error => _error ?? throw new InvalidOperationException("A successful result has no error.");

    public static LegalParseResult Success(LegalDocument document) => new(document, null);

    public static LegalParseResult Failure(string reason, int line) => new(null, new LegalParseError(reason, line));
}
