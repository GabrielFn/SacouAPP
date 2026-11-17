using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace Sacou.Architecture.Tests;

/// <summary>
/// Rules for the Postgres integration setup (docs/arquitetura/adr/0020-postgres-local-e-testes-de-integracao.md).
/// They match text, so they are an alarm against accidental removal, not a barrier against a hostile PR:
/// that barrier is the mandatory human reading of ci.yml. Each rule takes text, so tests plant violations.
/// </summary>
internal static partial class IntegrationSetupRules
{
    internal const string IntegrationProjectName = "Sacou.Integration.Tests";
    internal const string RyukDigest = "sha256:7c1a8a9a47c780ed0f983770a662f80deb115d95cce3e2daa3d12115b8cd28f0";

    private const string IncludeAttribute = "Include";
    private const string VersionAttribute = "Version";
    private const string VersionOverrideAttribute = "VersionOverride";
    private const string SolutionProjectElement = "Project";
    private const string PathAttribute = "Path";
    private const string ProjectPath = "apps/api/tests/Sacou.Integration.Tests/Sacou.Integration.Tests.csproj";
    private const string AuditReport = ".nuget-audit-integration.json";

    /// <summary>A missing or unexpected `api` output must run the API steps, never skip them.</summary>
    internal const string ApiStepCondition = "if: needs.changes.outputs.api != 'false'";

    private static readonly string[] ExactVersionPackages = ["Testcontainers", "Testcontainers.PostgreSql"];

    private static readonly string[] RequiredCiFragments =
    [
        "- name: Test API integration",
        ApiStepCondition,
        "dotnet test --project apps/api/tests/Sacou.Integration.Tests",
        "docker image ls --digests",
        RyukDigest,
        "- name: Check Postgres compose",
        "up -d --wait",
        "pg_isready -h 127.0.0.1",
        "port postgres 5432",
        "127.0.0.1:5432",
        "down -v",
    ];

    private static readonly string[] ForbiddenCiFragments =
    [
        "TESTCONTAINERS_RYUK",
        "--ignore-exit-code",
        "continue-on-error",
        "|| true",
        "if: false",
        "outputs.api ==",
        "outputs.app ==",
    ];

    private static readonly string[] ForbiddenPatterns =
    [
        @"\bSkip\w*",
        @"\bExplicit\s*=",
        "GetEnvironmentVariable",
        "TestcontainersSettings",
        @"WithCleanUp\s*\(\s*false",
        "TESTCONTAINERS_RYUK",
    ];

    internal static IReadOnlyList<string> CiViolations(string workflow)
    {
        var code = WithoutComments(workflow);
        return
        [
            .. RequiredCiFragments
                .Where(fragment => !code.Contains(fragment, StringComparison.Ordinal))
                .Select(fragment => $"ci.yml lacks: {fragment}"),
            .. ForbiddenCiFragments
                .Where(fragment => code.Contains(fragment, StringComparison.Ordinal))
                .Select(fragment => $"ci.yml contains: {fragment}"),
        ];
    }

    /// <summary>The compose image line and the builder argument must be one pinned image, and the same one.</summary>
    internal static IReadOnlyList<string> ImageViolations(string testSource, string compose)
    {
        var violations = new List<string>();
        var composeImages = ComposeImagePattern().Matches(compose).Select(match => match.Groups[1].Value).ToList();
        var testImages = ImageConstantPattern().Matches(testSource).Select(match => match.Groups[1].Value).ToList();
        var builders = BuilderCallPattern().Matches(testSource).Select(match => match.Groups[1].Value).ToList();

        if (composeImages.Count != 1 || !PinnedImagePattern().IsMatch(composeImages[0]))
        {
            violations.Add($"docker-compose.yml needs exactly one image line, pinned as tag@sha256, found [{string.Join(", ", composeImages)}]");
        }

        if (testImages.Count != 1 || !PinnedImagePattern().IsMatch(testImages[0]))
        {
            violations.Add($"Test code needs exactly one pinned Image constant, found [{string.Join(", ", testImages)}]");
        }

        if (builders.Count != 1 || builders[0] != "Image")
        {
            violations.Add($"PostgreSqlBuilder must receive the Image constant, found [{string.Join(", ", builders)}]");
        }

        if (composeImages.Count == 1 && testImages.Count == 1 && composeImages[0] != testImages[0])
        {
            violations.Add($"Image differs: test {testImages[0]}, compose {composeImages[0]}");
        }

        return violations;
    }

    internal static IReadOnlyList<string> ComposeViolations(string compose) =>
        WithoutComments(compose).Contains("127.0.0.1:5432:5432", StringComparison.Ordinal)
            ? []
            : ["docker-compose.yml must publish 127.0.0.1:5432:5432"];

    internal static IReadOnlyList<string> SolutionViolations(XDocument solution) =>
    [
        .. solution.Descendants(SolutionProjectElement)
            .Select(project => (string?)project.Attribute(PathAttribute) ?? string.Empty)
            .Where(path => path.Contains(IntegrationProjectName, StringComparison.Ordinal))
            .Select(path => $"Sacou.slnx lists the integration project: {path}"),
    ];

    /// <summary>Applies to the C# files and to the .csproj of the integration project.</summary>
    internal static IReadOnlyList<string> SourceViolations(string fileName, string source) =>
    [
        .. ForbiddenPatterns
            .Where(pattern => Regex.IsMatch(source, pattern))
            .Select(pattern => $"{fileName} matches forbidden pattern: {pattern}"),
    ];

    /// <summary>The Testcontainers version sets the pinned Ryuk digest, so it must be exact: [x.y.z].</summary>
    internal static IReadOnlyList<string> PackageVersionViolations(XDocument packages)
    {
        var violations = new List<string>();
        foreach (var package in ExactVersionPackages)
        {
            var versions = packages.Descendants("PackageVersion")
                .Where(element => (string?)element.Attribute(IncludeAttribute) == package)
                .Select(element => (string?)element.Attribute(VersionAttribute) ?? string.Empty)
                .ToList();
            if (versions.Count != 1 || !ExactVersionPattern().IsMatch(versions[0]))
            {
                violations.Add($"{package} needs exactly one exact version like [4.16.0], found [{string.Join(", ", versions)}]");
            }
        }

        return violations;
    }

    /// <summary>A version on the reference itself would bypass the central, exact one.</summary>
    internal static IReadOnlyList<string> ProjectVersionViolations(XDocument project) =>
    [
        .. project.Descendants("PackageReference")
            .Where(element => element.Attribute(VersionOverrideAttribute) is not null || element.Attribute(VersionAttribute) is not null)
            .Select(element => $"PackageReference overrides the central version: {(string?)element.Attribute(IncludeAttribute)}"),
    ];

    /// <summary>The solution audit cannot see the project outside it, so the script must list and read it too.</summary>
    internal static IReadOnlyList<string> AuditViolations(string packageJson)
    {
        var script = AuditScriptPattern().Match(packageJson).Groups[1].Value;
        return
        [
            .. new[]
            {
                $"dotnet list {ProjectPath} package --vulnerable",
                $"check-dotnet-audit.mjs {AuditReport}",
                $"> {AuditReport}",
            }
            .Where(fragment => !script.Contains(fragment, StringComparison.Ordinal))
            .Select(fragment => $"package.json audit:api lacks: {fragment}"),
        ];
    }

    private static string WithoutComments(string text) =>
        string.Join('\n', text.Split('\n').Where(line => !line.TrimStart().StartsWith('#')));

    [GeneratedRegex(@"^postgres:\d+\.\d+@sha256:[0-9a-f]{64}$")]
    private static partial Regex PinnedImagePattern();

    [GeneratedRegex(@"^\s*image:\s*(\S+)", RegexOptions.Multiline)]
    private static partial Regex ComposeImagePattern();

    [GeneratedRegex(@"const\s+string\s+Image\s*=\s*""([^""]*)""")]
    private static partial Regex ImageConstantPattern();

    [GeneratedRegex(@"new\s+PostgreSqlBuilder\s*\(\s*([^)\s]*)\s*\)")]
    private static partial Regex BuilderCallPattern();

    [GeneratedRegex(@"^\[\d+\.\d+\.\d+\]$")]
    private static partial Regex ExactVersionPattern();

    [GeneratedRegex(@"""audit:api""\s*:\s*""([^""]*)""")]
    private static partial Regex AuditScriptPattern();
}
