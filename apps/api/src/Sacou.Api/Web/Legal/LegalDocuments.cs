namespace Sacou.Api.Web.Legal;

/// <summary>The two legal texts the API publishes (E6.1, ADR 0083). A fake in the tests, to try hostile content on the page.</summary>
internal interface ILegalDocuments
{
    LegalDocument Terms { get; }

    LegalDocument Privacy { get; }
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
/// Both texts read once, on the first use: an invalid one stops the start (<see cref="LegalDocumentsCheck"/>), with
/// the file and the line, never the content.
/// </summary>
internal sealed class LegalDocuments : ILegalDocuments
{
    public const string TermsFile = "termos-de-uso.md";
    public const string PrivacyFile = "politica-de-privacidade.md";

    public LegalDocuments(ILegalDocumentSource source)
    {
        ArgumentNullException.ThrowIfNull(source);
        Terms = Load(source, TermsFile);
        Privacy = Load(source, PrivacyFile);
    }

    public LegalDocument Terms { get; }

    public LegalDocument Privacy { get; }

    private static LegalDocument Load(ILegalDocumentSource source, string fileName)
    {
        var result = LegalDocumentParser.Parse(source.Read(fileName));
        return result.IsSuccess
            ? result.Document
            : throw new InvalidOperationException($"docs/legal/{fileName}, line {result.Error.Line}: {result.Error.Reason}.");
    }
}

/// <summary>Reads the texts while the host starts, so a document the reader refuses never reaches a deploy that answers.</summary>
internal sealed class LegalDocumentsCheck(ILegalDocuments documents) : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        _ = documents.Terms;
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
