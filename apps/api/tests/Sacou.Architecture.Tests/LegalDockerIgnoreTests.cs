using Xunit;

namespace Sacou.Architecture.Tests;

/// <summary>E6.1 tester: the Docker context must let the legal Markdown files in, or the API image cannot embed them.</summary>
public sealed class LegalDockerIgnoreTests
{
    private const string LegalInclude = "!docs/legal/*.md";

    private static bool Reopens(string dockerIgnore) =>
        dockerIgnore.Split('\n').Select(line => line.Trim()).Contains(LegalInclude);

    [Fact]
    public void DockerIgnore_ReopensTheLegalMarkdownFiles()
    {
        Assert.True(Reopens(RepositoryFiles.ReadRepositoryFile(".dockerignore")), $".dockerignore must contain {LegalInclude}");
    }

    [Theory]
    [InlineData("*\n!apps/**\n")]
    [InlineData("*\n# !docs/legal/*.md\n")]
    [InlineData("*\n!docs/legal/*.txt\n")]
    public void PlantedDockerIgnore_WithoutTheLegalLine_IsDetected(string dockerIgnore)
    {
        Assert.False(Reopens(dockerIgnore));
    }
}
