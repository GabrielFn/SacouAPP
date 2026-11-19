using System.Text.RegularExpressions;

namespace Sacou.Architecture.Tests;

/// <summary>
/// The round page's rules that a reading of the sources answers (E3.12 Part 2, ADR 0070, D5 and D7): Razor never writes
/// raw HTML, no page takes a POST, no file of the web loads Google Fonts, the closed list of pages, and the image
/// carries the built script.
/// </summary>
internal static partial class WebPageRules
{
    /// <summary>Written by hand: a new page is a decision about what is anonymous, never a side effect (ADR 0040, D4).</summary>
    internal static readonly IReadOnlyList<string> Pages =
    [
        "Round.cshtml",
        "Round.cshtml.cs",
        "Shared/_OpenGraph.cshtml",
        "_ViewImports.cshtml",
    ];

    internal static string PagesDirectory => Path.Combine(RepositoryFiles.ApiDirectory, "src", "Sacou.Api", "Web", "Pages");

    internal static IReadOnlyList<string> RazorViolations(string path, string source) =>
    [
        .. RawHtml().Matches(source).Select(match => $"{path}: raw HTML ({match.Value}); Razor must encode every value"),
        .. PostHandler().Matches(source).Select(match => $"{path}: a page handler other than GET ({match.Value})"),
        .. PostForm().Matches(source).Select(match => $"{path}: a form that posts ({match.Value})"),
    ];

    internal static IReadOnlyList<string> FontViolations(string path, string source) =>
        GoogleFonts().IsMatch(source) ? [$"{path}: Google Fonts; the page serves its own fonts (ADR 0070, D5)"] : [];

    internal static IReadOnlyList<string> PageListViolations(IEnumerable<string> found) =>
    [
        .. found.Except(Pages, StringComparer.Ordinal).Select(page => $"a page outside the closed list: {page}"),
        .. Pages.Except(found, StringComparer.Ordinal).Select(page => $"a listed page is gone: {page}"),
    ];

    /// <summary>The Node stage builds @sacou/web and the .NET stage copies its output before the publish.</summary>
    internal static IReadOnlyList<string> DockerfileViolations(string dockerfile)
    {
        var build = dockerfile.IndexOf("pnpm --filter @sacou/web build", StringComparison.Ordinal);
        var copy = dockerfile.IndexOf("COPY --from=web /source/apps/api/src/Sacou.Api/wwwroot/web/", StringComparison.Ordinal);
        var publish = dockerfile.IndexOf("dotnet publish", StringComparison.Ordinal);
        return build >= 0 && copy > build && publish > copy
            ? []
            : ["the Dockerfile must build @sacou/web and copy wwwroot/web before dotnet publish"];
    }

    internal static IEnumerable<string> FilesUnder(string directory, params string[] patterns) =>
        patterns.SelectMany(pattern => Directory.EnumerateFiles(directory, pattern, SearchOption.AllDirectories))
            .Where(file => !file.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar).Any(part => part is "bin" or "obj" or "node_modules"));

    [GeneratedRegex(@"Html\.Raw|@:|MarkupString|new\s+HtmlString|IHtmlContent\s+\w+\s*=")]
    private static partial Regex RawHtml();

    [GeneratedRegex(@"\bOn(Post|Put|Delete|Patch)\w*\s*\(")]
    private static partial Regex PostHandler();

    [GeneratedRegex(@"method\s*=\s*""?post", RegexOptions.IgnoreCase)]
    private static partial Regex PostForm();

    [GeneratedRegex(@"fonts\.googleapis\.com|fonts\.gstatic\.com", RegexOptions.IgnoreCase)]
    private static partial Regex GoogleFonts();
}
