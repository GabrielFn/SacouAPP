using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace Sacou.Architecture.Tests;

/// <summary>Rules and sources that need the repository itself, because the compiled output cannot answer them.</summary>
internal static partial class RepositoryFiles
{
    private const string SourceFilePattern = "*.cs";
    private const string DomainFolder = "Domain";
    private const string SolutionFileName = "Sacou.slnx";
    private const string ModuleProjectPrefix = "Sacou.Modules.";
    private const string TestProjectsPathPrefix = "apps/api/tests/";
    private const string ProjectFilePattern = "*.csproj";
    private const string PlainSdk = "Microsoft.NET.Sdk";
    private const string SdkAttribute = "Sdk";
    private const string PathAttribute = "Path";
    private const string IncludeAttribute = "Include";
    private const string SolutionProjectElement = "Project";
    private const string EmbeddedResourceElement = "EmbeddedResource";
    private const string CatalogAssembly = "Sacou.Modules.Matches";
    private const string LineCommentStart = "//";
    private const string RemainderOperator = "%";

    internal const string CatalogResourceName = "Sacou.Modules.Matches.formations.json";
    internal const string CatalogPath = "packages/volley-rules/src/formations/formations.json";
    internal const string SettingsCatalogAssembly = "Sacou.Modules.Groups";
    internal const string SettingsCatalogResourceName = "Sacou.Modules.Groups.settings-catalog.json";
    internal const string SettingsCatalogPath = "packages/match-engine/src/settings/settings-catalog.json";

    /// <summary>Written by hand: a file lost from the repository must fail, not vanish from the list.</summary>
    internal static readonly IReadOnlyList<string> SharedJsonFiles =
    [
        CatalogPath,
        SettingsCatalogPath,
        "packages/volley-rules/golden/formations.json",
        "packages/volley-rules/golden/overlap.json",
        "packages/volley-rules/golden/player-card-level.json",
        "packages/volley-rules/golden/draw-balance.json",
        "packages/volley-rules/golden/pix.json",
        "packages/volley-rules/golden/pix-crc.json",
        "packages/match-engine/golden/event-log.json",
        "packages/match-engine/golden/score-rules.json",
        "packages/match-engine/golden/score-payloads.json",
        "packages/match-engine/golden/score-events.json",
        "packages/match-engine/golden/rotation-rules.json",
        "packages/match-engine/golden/rotation-events.json",
        "packages/match-engine/golden/serve-alignment.json",
        "packages/match-engine/golden/bench-events.json",
        "packages/match-engine/golden/libero-alignment.json",
        "packages/match-engine/golden/libero-events.json",
        "packages/match-engine/golden/queue-events.json",
        "packages/match-engine/golden/queue-plans.json",
        "packages/match-engine/golden/queue-modes.json",
        "packages/match-engine/golden/corrections-events.json",
        "packages/match-engine/golden/attributions-events.json",
        "packages/match-engine/golden/stats-events.json",
        "packages/match-engine/golden/server-checks.json",
        "packages/match-engine/golden/settings-resolver.json",
    ];

    /// <summary>The golden folders of the shared packages, as a test project path reaches them.</summary>
    private static readonly string[] GoldenFromTestProject =
    [
        "../../../../packages/volley-rules/golden/",
        "../../../../packages/match-engine/golden/",
    ];

    private static readonly HashSet<string> SharedJsonFileNames = [.. SharedJsonFiles.Select(path => path.Split('/')[^1])];

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

    private static readonly HashSet<string> GeneratedFolders = ["bin", "obj"];

    private static readonly Lazy<string> Root = new(FindRoot);

    internal static string ModulesDirectory => Path.Combine(Root.Value, "apps", "api", "src", "Sacou.Modules");

    internal static string IntegrationProjectDirectory =>
        Path.Combine(Root.Value, "apps", "api", "tests", "Sacou.Integration.Tests");

    internal static string ApiDirectory => Path.Combine(Root.Value, "apps", "api");

    internal static string ReadRepositoryFile(params string[] segments) =>
        File.ReadAllText(Path.Combine([Root.Value, .. segments]));

    internal static byte[] ReadRepositoryBytes(params string[] segments) =>
        File.ReadAllBytes(Path.Combine([Root.Value, .. segments]));

    internal static XDocument Solution => XDocument.Load(Path.Combine(Root.Value, SolutionFileName));

    internal static XDocument SharedProject =>
        XDocument.Load(Path.Combine(Root.Value, "apps", "api", "src", "Sacou.Shared", "Sacou.Shared.csproj"));

    internal static IReadOnlyList<string> ModuleNamesInDirectory(string directory) =>
        [.. Directory.GetFiles(directory, ProjectFilePattern, SearchOption.AllDirectories)
            .Select(path => Path.GetFileNameWithoutExtension(path))];

    /// <summary>Goes by folder, not by a ".Tests" suffix, so that a fake module named like a test project still fails.</summary>
    internal static IReadOnlyList<string> ModuleNamesInSolution(XDocument solution) =>
        [.. solution.Descendants(SolutionProjectElement)
            .Select(project => (string?)project.Attribute(PathAttribute) ?? string.Empty)
            .Where(path => !path.StartsWith(TestProjectsPathPrefix, StringComparison.Ordinal))
            .Select(path => Path.GetFileNameWithoutExtension(path))
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

    /// <summary>
    /// Files in a Domain folder must declare the namespace their path spells. Without this, a wrong
    /// namespace takes the file out of the Domain rule, which goes by namespace.
    /// </summary>
    internal static IReadOnlyList<string> DomainFolderViolations(string modulesDirectory) =>
        [.. from path in Directory.GetFiles(modulesDirectory, SourceFilePattern, SearchOption.AllDirectories)
            let folders = FoldersBelow(modulesDirectory, path)
            where folders.Contains(DomainFolder) && !folders.Any(GeneratedFolders.Contains)
            let expected = ModuleProjectPrefix + string.Join('.', folders)
            let declared = DeclaredNamespaces(File.ReadAllText(path))
            where declared.Count == 0 || declared.Any(name => name != expected)
            select $"{Path.GetRelativePath(modulesDirectory, path)}: expected namespace {expected}, found [{string.Join(", ", declared)}]"];

    internal static string CourtSessionsDirectory =>
        Path.Combine(ModulesDirectory, "Matches", "Domain", "CourtSessions");

    /// <summary>
    /// Lines of C# code that use the remainder operator, comments aside. Zones and slots move by
    /// position in a table, never by arithmetic, so a wrong <c>%</c> cannot hide behind right answers
    /// in the golden files (ADR 0033, D9).
    /// </summary>
    internal static IReadOnlyList<string> RemainderOperatorViolations(string directory) =>
        [.. from path in Directory.GetFiles(directory, SourceFilePattern, SearchOption.AllDirectories)
            let lines = File.ReadAllLines(path)
            from index in Enumerable.Range(0, lines.Length)
            let code = lines[index].Split(LineCommentStart)[0]
            where code.Contains(RemainderOperator, StringComparison.Ordinal)
            select $"{Path.GetRelativePath(directory, path)}:{index + 1}"];

    /// <summary>Any file named like a shared JSON file, outside what the build generates: nobody copies a case.</summary>
    internal static IReadOnlyList<string> CopiedSharedFileViolations(string directory) =>
        [.. from path in Directory.GetFiles(directory, "*.json", SearchOption.AllDirectories)
            where SharedJsonFileNames.Contains(Path.GetFileName(path))
            let relative = Path.GetRelativePath(directory, path)
            where !relative.Split(Path.DirectorySeparatorChar).Any(GeneratedFolders.Contains)
            select relative];

    internal static IReadOnlyList<string> TestProjectFiles() =>
        Directory.GetFiles(Path.Combine(ApiDirectory, "tests"), ProjectFilePattern, SearchOption.AllDirectories);

    /// <summary>Test projects embed the golden files from their source, and nothing else.</summary>
    internal static IReadOnlyList<string> TestResourceViolations(XDocument project) =>
        [.. project.Descendants(EmbeddedResourceElement)
            .Select(resource => (string?)resource.Attribute(IncludeAttribute) ?? string.Empty)
            .Where(path => !GoldenFromTestProject.Any(folder => path.StartsWith(folder, StringComparison.Ordinal)))
            .Select(path => $"EmbeddedResource outside the golden folder: {path}")];

    /// <summary>The formations catalog in Matches, the settings catalog in Groups and no other resource, in any production assembly: a golden file never ships.</summary>
    internal static IReadOnlyList<string> ProductionResourceViolations(string assembly, IReadOnlyCollection<string> resources)
    {
        string[] expected = assembly switch
        {
            CatalogAssembly => [CatalogResourceName],
            SettingsCatalogAssembly => [SettingsCatalogResourceName],
            _ => [],
        };
        return
        [
            .. resources.Except(expected).Select(name => $"{assembly}: unexpected resource {name}"),
            .. expected.Except(resources).Select(name => $"{assembly}: missing resource {name}"),
        ];
    }

    private static string[] FoldersBelow(string root, string path) =>
        Path.GetDirectoryName(Path.GetRelativePath(root, path))?.Split(Path.DirectorySeparatorChar) ?? [];

    private static List<string> DeclaredNamespaces(string source) =>
        [.. NamespaceDeclarationPattern().Matches(source).Select(match => match.Groups[1].Value)];

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

    [GeneratedRegex(@"^\s*namespace\s+([\w.]+)", RegexOptions.Multiline)]
    private static partial Regex NamespaceDeclarationPattern();
}
