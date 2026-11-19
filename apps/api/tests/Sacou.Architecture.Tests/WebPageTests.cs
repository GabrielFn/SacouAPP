using Xunit;

namespace Sacou.Architecture.Tests;

/// <summary>E3.12 Part 2, case 7 of the steps: the round page's rules on the real files, then on planted violations.</summary>
public sealed class WebPageTests
{
    [Fact]
    public void Pages_EncodeEverything_AndTakeNoPost()
    {
        ViolationAssert.None(WebPageRules.FilesUnder(WebPageRules.PagesDirectory, "*.cshtml", "*.cs")
            .SelectMany(file => WebPageRules.RazorViolations(file, File.ReadAllText(file))));
    }

    [Fact]
    public void Pages_AreTheClosedList()
    {
        var found = WebPageRules.FilesUnder(WebPageRules.PagesDirectory, "*.cshtml", "*.cs")
            .Select(file => Path.GetRelativePath(WebPageRules.PagesDirectory, file).Replace('\\', '/'));

        ViolationAssert.None(WebPageRules.PageListViolations(found));
    }

    [Fact]
    public void WebFiles_NeverLoadGoogleFonts()
    {
        var root = RepositoryFiles.RepositoryRoot;
        var files = WebPageRules.FilesUnder(Path.Combine(root, "apps", "web", "src"), "*.ts", "*.css")
            .Concat(WebPageRules.FilesUnder(Path.Combine(RepositoryFiles.ApiDirectory, "src", "Sacou.Api", "Web"), "*.cshtml", "*.cs"));

        ViolationAssert.None(files.SelectMany(file => WebPageRules.FontViolations(file, File.ReadAllText(file))));
    }

    [Fact]
    public void Dockerfile_BuildsTheWebBeforeThePublish()
    {
        ViolationAssert.None(WebPageRules.DockerfileViolations(RepositoryFiles.ReadRepositoryFile("Dockerfile")));
    }

    [Theory]
    [InlineData("<p>@Html.Raw(Model.Name)</p>")]
    [InlineData("@: <b>@Model.Name</b>")]
    [InlineData("public IActionResult OnPostAsync() => Page();")]
    [InlineData("public void OnDelete() { }")]
    [InlineData("<form method=\"post\">")]
    [InlineData("<form method=POST>")]
    public void PlantedRazor_IsAViolation(string source)
    {
        Assert.NotEmpty(WebPageRules.RazorViolations("planted.cshtml", source));
    }

    [Theory]
    [InlineData("@import url(https://fonts.googleapis.com/css2?family=Inter);")]
    [InlineData("src: url(https://fonts.gstatic.com/s/inter.woff2)")]
    public void PlantedGoogleFonts_IsAViolation(string source)
    {
        Assert.NotEmpty(WebPageRules.FontViolations("planted.css", source));
    }

    [Fact]
    public void PlantedPage_AndAMissingOne_AreViolations()
    {
        Assert.NotEmpty(WebPageRules.PageListViolations([.. WebPageRules.Pages, "Admin.cshtml"]));
        Assert.NotEmpty(WebPageRules.PageListViolations(WebPageRules.Pages.Skip(1)));
    }

    [Theory]
    [InlineData("RUN pnpm --filter @sacou/web build\nRUN dotnet publish")]
    [InlineData("COPY --from=web /source/apps/api/src/Sacou.Api/wwwroot/web/ x\nRUN pnpm --filter @sacou/web build\nRUN dotnet publish")]
    [InlineData("RUN pnpm --filter @sacou/web build\nRUN dotnet publish\nCOPY --from=web /source/apps/api/src/Sacou.Api/wwwroot/web/ x")]
    public void PlantedDockerfile_WithoutTheWebInOrder_IsAViolation(string dockerfile)
    {
        Assert.NotEmpty(WebPageRules.DockerfileViolations(dockerfile));
    }
}
