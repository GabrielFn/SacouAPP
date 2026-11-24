using Sacou.Api.Web.Legal;
using Xunit;

namespace Sacou.Api.Tests.Web.Legal;

/// <summary>E6.1, cases 1 to 5: the restricted reader of <c>docs/legal/</c>, on fixtures and on the two real texts.</summary>
public sealed class LegalDocumentParserTests
{
    private const string Secret = "NOTA-SECRETA";

    private static readonly string[] ValidBody =
    [
        "# Termos de Teste",
        "",
        "Versão: 0.1 (rascunho)",
        "",
        "Atualizada em: 24/11/2026",
        "",
        "## Seção",
        "",
        "Primeira linha do parágrafo",
        "segunda linha, com acentos: ação, maçã.",
        "",
        "> " + Secret + " nunca publicada",
        "",
        "- item um",
        "- item dois",
        "",
        "### Subseção",
        "",
        "Fim.",
    ];

    private static string Document(IEnumerable<string> body, string newLine = "\n") =>
        string.Join(newLine, [Secret + " antes do início", "", LegalDocumentParser.StartMarker, .. body, LegalDocumentParser.EndMarker, Secret + " depois do fim"]);

    private static string WithLine(int index, string line) =>
        Document(ValidBody.Select((existing, position) => position == index ? line : existing));

    private static LegalDocument Parsed(string source)
    {
        var result = LegalDocumentParser.Parse(source);
        Assert.True(result.IsSuccess, result.IsSuccess ? null : $"{result.Error.Reason} (line {result.Error.Line})");
        return result.Document;
    }

    private static IEnumerable<string> Texts(LegalDocument document) =>
        document.Blocks.SelectMany(block => block switch
        {
            LegalBlock.Heading heading => [heading.Text],
            LegalBlock.Paragraph paragraph => [paragraph.Text],
            LegalBlock.BulletList list => list.Items,
            _ => [],
        }).Append(document.Title).Append(document.Version);

    [Fact]
    public void ValidDocument_HasTitleVersionDateAndTheBlocksInOrder()
    {
        var document = Parsed(Document(ValidBody));

        Assert.Equal("Termos de Teste", document.Title);
        Assert.Equal("0.1 (rascunho)", document.Version);
        Assert.Equal(new DateOnly(2026, 11, 24), document.UpdatedOn);
        Assert.Collection(
            document.Blocks,
            block => Assert.Equal(new LegalBlock.Heading(LegalDocumentParser.SectionLevel, "Seção"), block),
            block => Assert.Equal(new LegalBlock.Paragraph("Primeira linha do parágrafo segunda linha, com acentos: ação, maçã."), block),
            block => Assert.Equal(["item um", "item dois"], Assert.IsType<LegalBlock.BulletList>(block).Items),
            block => Assert.Equal(new LegalBlock.Heading(LegalDocumentParser.SubsectionLevel, "Subseção"), block),
            block => Assert.Equal(new LegalBlock.Paragraph("Fim."), block));
    }

    [Fact]
    public void NotesAndTextOutsideTheMarkers_AreNeverRead()
    {
        var document = Parsed(Document(ValidBody));

        Assert.DoesNotContain(Texts(document), text => text.Contains(Secret, StringComparison.Ordinal));
    }

    [Fact]
    public void CrlfAndLf_GiveTheSameDocument_AndTrailingSpacesAreIgnored()
    {
        var lf = Parsed(Document(ValidBody));
        var crlf = Parsed(Document(ValidBody.Select(line => line + "   "), "\r\n"));

        Assert.Equal(lf.Title, crlf.Title);
        Assert.Equal(lf.Version, crlf.Version);
        Assert.Equal(lf.UpdatedOn, crlf.UpdatedOn);
        Assert.Equal(Texts(lf), Texts(crlf));
    }

    [Theory]
    [InlineData("<script>alert(1)</script>")]
    [InlineData("Veja <a href=\"https://x\">aqui</a>.")]
    [InlineData("Veja [aqui](https://x).")]
    [InlineData("![logo](https://x/logo.png)")]
    [InlineData("| a | b |")]
    [InlineData("Texto em **negrito**.")]
    [InlineData("Texto com `código`.")]
    public void Markup_IsRefused(string line)
    {
        var result = LegalDocumentParser.Parse(WithLine(8, line));

        Assert.False(result.IsSuccess);
        Assert.Equal(LegalDocumentParser.Markup, result.Error.Reason);
        Assert.Equal(12, result.Error.Line);
    }

    [Theory]
    [InlineData("#### Fundo demais", LegalDocumentParser.DeepHeading)]
    [InlineData("##Sem espaço", LegalDocumentParser.DeepHeading)]
    [InlineData("# Outro título", LegalDocumentParser.SecondTitle)]
    [InlineData("1. item numerado", LegalDocumentParser.OtherList)]
    [InlineData("* item de asterisco", LegalDocumentParser.OtherList)]
    [InlineData("Versão: 0.2", LegalDocumentParser.HeaderOutOfPlace)]
    public void OtherConstructs_AreRefused(string line, string reason)
    {
        var result = LegalDocumentParser.Parse(WithLine(8, line));

        Assert.False(result.IsSuccess);
        Assert.Equal(reason, result.Error.Reason);
    }

    [Fact]
    public void AnItemThatGoesOnToTheNextLine_IsRefused()
    {
        var result = LegalDocumentParser.Parse(WithLine(14, "continuação do item"));

        Assert.False(result.IsSuccess);
        Assert.Equal(LegalDocumentParser.ItemContinues, result.Error.Reason);
    }

    [Theory]
    [InlineData(2, LegalDocumentParser.NoVersion)]
    [InlineData(4, LegalDocumentParser.NoUpdatedOn)]
    public void AMissingHeaderLine_IsRefused(int index, string reason)
    {
        var result = LegalDocumentParser.Parse(Document(ValidBody.Where((_, position) => position != index)));

        Assert.False(result.IsSuccess);
        Assert.Equal(reason, result.Error.Reason);
    }

    [Theory]
    [InlineData("Atualizada em: 31/02/2026", LegalDocumentParser.BadDate)]
    [InlineData("Atualizada em: 2026-11-24", LegalDocumentParser.BadDate)]
    [InlineData("Versão:", LegalDocumentParser.EmptyHeader)]
    public void ABadHeaderLine_IsRefused(string line, string reason)
    {
        var index = line.StartsWith("Versão", StringComparison.Ordinal) ? 2 : 4;

        var result = LegalDocumentParser.Parse(WithLine(index, line));

        Assert.False(result.IsSuccess);
        Assert.Equal(reason, result.Error.Reason);
    }

    [Fact]
    public void WithoutTheTitleFirst_IsRefused()
    {
        var result = LegalDocumentParser.Parse(Document(ValidBody.Skip(1)));

        Assert.False(result.IsSuccess);
        Assert.Equal(LegalDocumentParser.NoTitle, result.Error.Reason);
    }

    [Fact]
    public void AnEmptyPublishedPart_IsRefused()
    {
        Assert.False(LegalDocumentParser.Parse(Document([])).IsSuccess);
        Assert.Equal(LegalDocumentParser.NoBlocks, LegalDocumentParser.Parse(Document(ValidBody.Take(5))).Error.Reason);
    }

    [Fact]
    public void BrokenMarkers_AreRefused()
    {
        var body = string.Join('\n', ValidBody);
        var start = LegalDocumentParser.StartMarker;
        var end = LegalDocumentParser.EndMarker;

        Assert.Equal(LegalDocumentParser.NoStart, LegalDocumentParser.Parse(body).Error.Reason);
        Assert.Equal(LegalDocumentParser.EndBeforeStart, LegalDocumentParser.Parse(body + "\n" + end).Error.Reason);
        Assert.Equal(LegalDocumentParser.NoEnd, LegalDocumentParser.Parse(start + "\n" + body).Error.Reason);
        Assert.Equal(LegalDocumentParser.TwoStarts, LegalDocumentParser.Parse($"{start}\n{start}\n{body}\n{end}").Error.Reason);
        Assert.Equal(LegalDocumentParser.TwoEnds, LegalDocumentParser.Parse($"{start}\n{body}\n{end}\n{end}").Error.Reason);
        Assert.Equal(LegalDocumentParser.EndBeforeStart, LegalDocumentParser.Parse($"{end}\n{start}\n{body}\n{end}").Error.Reason);
    }

    [Theory]
    [InlineData(LegalDocuments.TermsFile, "Termos de Uso do Sacou")]
    [InlineData(LegalDocuments.PrivacyFile, "Política de Privacidade do Sacou")]
    public void TheRealEmbeddedTexts_AreValid_AndCarryNoReviewNote(string fileName, string title)
    {
        var document = Parsed(new EmbeddedLegalDocumentSource().Read(fileName));
        var texts = Texts(document).ToList();

        Assert.Equal(title, document.Title);
        Assert.NotEmpty(document.Blocks);
        foreach (var marker in new[] { "LACUNA", "CONFERIR", "RASCUNHO PARA REVISÃO", "pergunta 19", "NOTA", "publicar:" })
        {
            Assert.DoesNotContain(texts, text => text.Contains(marker, StringComparison.Ordinal));
        }

        // A 1.0 cannot go out with a placeholder left: the draft markers are only allowed while the version starts with 0.
        if (!document.Version.StartsWith("0.", StringComparison.Ordinal))
        {
            Assert.DoesNotContain(texts, text => text.Contains("a definir", StringComparison.OrdinalIgnoreCase));
            Assert.DoesNotContain(texts, text => text.Contains("rascunho", StringComparison.OrdinalIgnoreCase));
        }
    }

    [Fact]
    public void TheEmbeddedTexts_AreTheFilesOfDocsLegal()
    {
        var source = new EmbeddedLegalDocumentSource();
        var folder = Path.Combine(RepositoryRoot(), "docs", "legal");

        foreach (var fileName in new[] { LegalDocuments.TermsFile, LegalDocuments.PrivacyFile })
        {
            Assert.Equal(
                File.ReadAllText(Path.Combine(folder, fileName)).ReplaceLineEndings("\n"),
                source.Read(fileName).ReplaceLineEndings("\n"));
        }
    }

    [Fact]
    public void AnInvalidText_StopsTheLoad_WithTheFileAndTheLine_ButNotTheContent()
    {
        var source = new FakeSource(WithLine(8, "<b>" + Secret + "</b>"));

        var error = Assert.Throws<InvalidOperationException>(() => new LegalDocuments(source));

        Assert.Contains(LegalDocuments.TermsFile, error.Message, StringComparison.Ordinal);
        Assert.Contains("line 12", error.Message, StringComparison.Ordinal);
        Assert.DoesNotContain(Secret, error.Message, StringComparison.Ordinal);
    }

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "Sacou.slnx")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new InvalidOperationException("Sacou.slnx not found above the test folder.");
    }

    private sealed class FakeSource(string content) : ILegalDocumentSource
    {
        public string Read(string fileName) => content;
    }
}
