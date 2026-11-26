namespace Sacou.Api.Web.Legal;

/// <summary>The legal texts the API publishes (E6.1, ADR 0083; the account deletion page, E6.4). A fake in the tests, to try hostile content on the page.</summary>
internal interface ILegalDocuments
{
    LegalDocument Terms { get; }

    LegalDocument Privacy { get; }

    LegalDocument AccountDeletion { get; }
}

/// <summary>Where the raw Markdown of each text comes from: the files of <c>docs/legal/</c>, built into this assembly.</summary>
internal interface ILegalDocumentSource
{
    string Read(string fileName);
}

/// <summary>
/// Reads <c>docs/legal/*.md</c> embedded at build time (the <c>Dockerfile</c> copies the folder; no disk access, like the
/// formations catalog, ADR 0006): one source of truth for the text and its version, published with each deploy.
/// </summary>
internal sealed class EmbeddedLegalDocumentSource : ILegalDocumentSource
{
    public const string ResourcePrefix = "Sacou.Api.Legal.";

    public string Read(string fileName)
    {
        var resourceName = ResourcePrefix + fileName;
        using var stream = typeof(EmbeddedLegalDocumentSource).Assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"Embedded resource \"{resourceName}\" not found.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}

/// <summary>
/// The texts read once, while the host starts: an invalid one stops the start (<c>WebSetup.ReadSacouLegalDocuments</c>), with
/// the file and the line, never the content.
/// </summary>
internal sealed class LegalDocuments : ILegalDocuments
{
    public const string TermsFile = "termos-de-uso.md";
    public const string PrivacyFile = "politica-de-privacidade.md";
    public const string AccountDeletionFile = "exclusao-de-conta.md";

    public LegalDocuments(ILegalDocumentSource source)
    {
        ArgumentNullException.ThrowIfNull(source);
        Terms = Load(source, TermsFile);
        Privacy = Load(source, PrivacyFile);
        AccountDeletion = Load(source, AccountDeletionFile);
    }

    public LegalDocument Terms { get; }

    public LegalDocument Privacy { get; }

    public LegalDocument AccountDeletion { get; }

    private static LegalDocument Load(ILegalDocumentSource source, string fileName)
    {
        var result = LegalDocumentParser.Parse(source.Read(fileName));
        return result.IsSuccess
            ? result.Document
            : throw new InvalidOperationException($"docs/legal/{fileName}, line {result.Error.Line}: {result.Error.Reason}.");
    }
}
