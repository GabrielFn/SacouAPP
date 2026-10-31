using System.Xml.Linq;

namespace Sacou.Architecture.Tests;

/// <summary>Rules and sources that need the repository itself, because the compiled output cannot answer them.</summary>
internal static class RepositoryFiles
{
    private const string SolutionFileName = "Sacou.slnx";
    private const string ModuleProjectPrefix = "Sacou.Modules.";
    private const string ProjectFilePattern = "*.csproj";
    private const string PlainSdk = "Microsoft.NET.Sdk";
    private const string SdkAttribute = "Sdk";
    private const string PathAttribute = "Path";
    private const string IncludeAttribute = "Include";
    private const string SolutionProjectElement = "Project";

    /// <summary>Anything that brings code into a project, used or not. The compiled assembly hides unused ones.</summary>
    private static readonly HashSet<string> DependencyElements =
    [
        "FrameworkReference",
        "Import",
        "PackageReference",
        "ProjectReference",
        "Reference",
        "Sdk",
    ];

    private static readonly Lazy<string> Root = new(FindRoot);

    internal static string ModulesDirectory => Path.Combine(Root.Value, "apps", "api", "src", "Sacou.Modules");

    internal static XDocument Solution => XDocument.Load(Path.Combine(Root.Value, SolutionFileName));

    internal static XDocument SharedProject =>
        XDocument.Load(Path.Combine(Root.Value, "apps", "api", "src", "Sacou.Shared", "Sacou.Shared.csproj"));

    internal static IReadOnlyList<string> ModuleNamesInDirectory(string directory) =>
        [.. Directory.GetFiles(directory, ProjectFilePattern, SearchOption.AllDirectories)
            .Select(path => Path.GetFileNameWithoutExtension(path))];

    internal static IReadOnlyList<string> ModuleNamesInSolution(XDocument solution) =>
        [.. solution.Descendants(SolutionProjectElement)
            .Select(project => Path.GetFileNameWithoutExtension((string?)project.Attribute(PathAttribute) ?? string.Empty))
            .Where(name => name.StartsWith(ModuleProjectPrefix, StringComparison.Ordinal))];

    /// <summary>A project with no dependencies: only the plain SDK and no references of any kind.</summary>
    internal static IReadOnlyList<string> ProjectDependencyViolations(XDocument project)
    {
        var sdk = (string?)project.Root?.Attribute(SdkAttribute);
        return
        [
            .. sdk == PlainSdk ? Array.Empty<string>() : [$"SDK: {sdk}"],
            .. project.Descendants()
                .Where(element => DependencyElements.Contains(element.Name.LocalName))
                .Select(element => $"{element.Name.LocalName}: {(string?)element.Attribute(IncludeAttribute)}"),
        ];
    }

    private static string FindRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, SolutionFileName)))
        {
            directory = directory.Parent;
        }

        return directory?.FullName
            ?? throw new InvalidOperationException($"{SolutionFileName} not found above {AppContext.BaseDirectory}.");
    }
}
