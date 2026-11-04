using Xunit;

namespace Sacou.Architecture.Tests;

/// <summary>
/// Size and complexity limits of the production code (ADR 0034). The compiler checks the complexity
/// (CA1502); these tests check the file size and that the complexity rule stays configured.
/// </summary>
public sealed class CodeMetricsTests
{
    private const string MetricsConfigFile = "CodeMetricsConfig.txt";
    private const string ExpectedMetricsConfig = "CA1502: 10";
    private const string ProductionSection = "[apps/api/src/**.cs]";
    private const string ComplexitySeverity = "dotnet_diagnostic.CA1502.severity = warning";
    private const string SourceFile = "Big.cs";
    private const string CodeLine = "var value = 1;";
    private const int ExtraLines = 100;

    [Fact]
    public void ProductionFiles_StayWithinTheLineLimit()
    {
        ViolationAssert.None(RepositoryFiles.OversizedSourceFileViolations(RepositoryFiles.ApiSourceDirectory));
    }

    [Theory]
    [InlineData(RepositoryFiles.MaxSourceFileLines + 1, 0, 1)]
    [InlineData(RepositoryFiles.MaxSourceFileLines, ExtraLines, 0)]
    public void OversizedFile_IsReportedWithoutCountingBlankLines(int codeLines, int blankLines, int expected)
    {
        var directory = Directory.CreateTempSubdirectory("sacou-size-");
        try
        {
            var folder = directory.CreateSubdirectory("Foo");
            WriteSource(folder.FullName, codeLines, blankLines);

            Assert.Equal(expected, RepositoryFiles.OversizedSourceFileViolations(directory.FullName).Count);
        }
        finally
        {
            directory.Delete(recursive: true);
        }
    }

    [Theory]
    [InlineData("bin")]
    [InlineData("obj")]
    public void OversizedFileInBuildOutput_IsNotReported(string generatedFolder)
    {
        var directory = Directory.CreateTempSubdirectory("sacou-size-");
        try
        {
            var folder = directory.CreateSubdirectory(Path.Combine("Foo", generatedFolder));
            WriteSource(folder.FullName, RepositoryFiles.MaxSourceFileLines + ExtraLines, 0);

            Assert.Empty(RepositoryFiles.OversizedSourceFileViolations(directory.FullName));
        }
        finally
        {
            directory.Delete(recursive: true);
        }
    }

    [Fact]
    public void ComplexityLimit_IsTheAgreedOne()
    {
        var config = RepositoryFiles.ReadRepositoryFile("apps", "api", "src", MetricsConfigFile);

        Assert.Equal(ExpectedMetricsConfig, config.Trim());
    }

    /// <summary>A warning is an error here (TreatWarningsAsErrors), and only production code has the section.</summary>
    [Fact]
    public void ComplexityRule_IsOnForProductionCode()
    {
        var lines = RepositoryFiles.ReadRepositoryFile(".editorconfig").Split('\n').Select(line => line.Trim()).ToList();
        var section = lines.IndexOf(ProductionSection);

        Assert.True(section >= 0, $"{ProductionSection} not found in .editorconfig.");
        Assert.Contains(ComplexitySeverity, lines.Skip(section + 1).TakeWhile(line => !line.StartsWith('[')));
    }

    private static void WriteSource(string folder, int codeLines, int blankLines)
    {
        var lines = Enumerable.Repeat(CodeLine, codeLines).Concat(Enumerable.Repeat("   ", blankLines));
        File.WriteAllLines(Path.Combine(folder, SourceFile), lines);
    }
}
