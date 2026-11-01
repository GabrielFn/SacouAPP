using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace Sacou.Architecture.Tests;

/// <summary>
/// Rules for the Postgres integration setup (docs/arquitetura/adr/0020-postgres-local-e-testes-de-integracao.md).
/// Each rule reads text, so the tests can plant a violation without touching the real files.
/// </summary>
internal static partial class IntegrationSetupRules
{
    internal const string IntegrationProjectName = "Sacou.Integration.Tests";

    private const string TestcontainersPackage = "Testcontainers.PostgreSql";
    private const string PackageVersionElement = "PackageVersion";
    private const string IncludeAttribute = "Include";
    private const string VersionAttribute = "Version";
    private const string SolutionProjectElement = "Project";
    private const string PathAttribute = "Path";
    private const string AuditScript = "audit:api";

    private static readonly string[] RequiredCiFragments =
    [
        "- name: Test API integration",
        "dotnet test --project apps/api/tests/Sacou.Integration.Tests",
        "- name: Check Postgres compose",
        "up -d --wait",
        "pg_isready -h 127.0.0.1",
        "down -v",
    ];

    private static readonly string[] ForbiddenCiFragments =
    [
        "TESTCONTAINERS_RYUK",
        "--ignore-exit-code",
        "continue-on-error",
    ];

    private static readonly string[] ForbiddenSourceFragments =
    [
        "Assert.Skip",
        "SkipUnless",
        "SkipWhen",
        "Skip =",
        "GetEnvironmentVariable",
    ];

    internal static IReadOnlyList<string> CiViolations(string workflow) =>
    [
        .. RequiredCiFragments
            .Where(fragment => !workflow.Contains(fragment, StringComparison.Ordinal))
            .Select(fragment => $"ci.yml lacks: {fragment}"),
        .. ForbiddenCiFragments
            .Where(fragment => workflow.Contains(fragment, StringComparison.Ordinal))
            .Select(fragment => $"ci.yml contains: {fragment}"),
    ];

    /// <summary>Test code and compose must each name one pinned Postgres image, and the same one.</summary>
    internal static IReadOnlyList<string> ImageViolations(string testSource, string compose)
    {
        var inTest = PinnedImagePattern().Matches(testSource).Select(match => match.Value).Distinct().ToList();
        var inCompose = PinnedImagePattern().Matches(compose).Select(match => match.Value).Distinct().ToList();
        var violations = new List<string>();
        if (inTest.Count != 1)
        {
            violations.Add($"Test code must name exactly one tag@sha256 image, found {inTest.Count}");
        }

        if (inCompose.Count != 1)
        {
            violations.Add($"docker-compose.yml must name exactly one tag@sha256 image, found {inCompose.Count}");
        }

        if (inTest.Count == 1 && inCompose.Count == 1 && inTest[0] != inCompose[0])
        {
            violations.Add($"Image differs: test {inTest[0]}, compose {inCompose[0]}");
        }

        return violations;
    }

    internal static IReadOnlyList<string> SolutionViolations(XDocument solution) =>
    [
        .. solution.Descendants(SolutionProjectElement)
            .Select(project => (string?)project.Attribute(PathAttribute) ?? string.Empty)
            .Where(path => path.Contains(IntegrationProjectName, StringComparison.Ordinal))
            .Select(path => $"Sacou.slnx lists the integration project: {path}"),
    ];

    internal static IReadOnlyList<string> SourceViolations(string fileName, string source) =>
    [
        .. ForbiddenSourceFragments
            .Where(fragment => source.Contains(fragment, StringComparison.Ordinal))
            .Select(fragment => $"{fileName} contains: {fragment}"),
    ];

    /// <summary>The package version sets the pinned Ryuk digest, so it must be exact: [x.y.z].</summary>
    internal static IReadOnlyList<string> PackageVersionViolations(XDocument packages)
    {
        var versions = packages.Descendants(PackageVersionElement)
            .Where(element => (string?)element.Attribute(IncludeAttribute) == TestcontainersPackage)
            .Select(element => (string?)element.Attribute(VersionAttribute) ?? string.Empty)
            .ToList();
        return versions.Count == 1 && ExactVersionPattern().IsMatch(versions[0])
            ? []
            : [$"{TestcontainersPackage} must have exactly one exact version like [4.16.0], found [{string.Join(", ", versions)}]"];
    }

    /// <summary>The solution audit cannot see the project outside it, so the script must list it too.</summary>
    internal static IReadOnlyList<string> AuditViolations(string packageJson)
    {
        var script = AuditScriptPattern().Match(packageJson);
        return script.Success && script.Groups[1].Value.Contains(IntegrationProjectName, StringComparison.Ordinal)
            ? []
            : [$"package.json script {AuditScript} does not audit {IntegrationProjectName}"];
    }

    [GeneratedRegex(@"postgres:\d+\.\d+@sha256:[0-9a-f]{64}")]
    private static partial Regex PinnedImagePattern();

    [GeneratedRegex(@"^\[\d+\.\d+\.\d+\]$")]
    private static partial Regex ExactVersionPattern();

    [GeneratedRegex(@"""audit:api""\s*:\s*""([^""]*)""")]
    private static partial Regex AuditScriptPattern();
}
