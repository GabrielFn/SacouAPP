using System.Text.RegularExpressions;
using Microsoft.Extensions.Hosting;

namespace Sacou.Architecture.Tests;

/// <summary>
/// Rules for the Cloud Run deploy (docs/arquitetura/adr/0068-deploy-cloud-run-neon.md). Like the integration setup
/// rules, they match text: an alarm against accidental removal, not a barrier against a hostile PR, which is the
/// mandatory human reading of the workflows. Each rule takes text, so the tests plant violations.
/// </summary>
internal static partial class DeploySetupRules
{
    internal const string WorkflowPath = ".github/workflows/deploy-api.yml";
    internal const string ActionPath = ".github/actions/deploy-cloud-run/action.yml";
    internal const string ServicePath = "deploy/cloud-run/service.yaml";
    internal const string DatabaseUrlVariable = "SACOU_DATABASE_URL";

    private const string AllFiles = "*";
    private const string EnvFiles = "**/.env*";
    private const string IgnoreReopen = "!";
    private const string IdTokenWrite = "id-token: write";
    private const string LocalActionPrefix = "./";
    private const string ImageFromBuild = "image: ${{ needs.build.outputs.image }}";
    private const string MaxScaleKey = "autoscaling.knative.dev/maxScale";
    private const string OneInstance = "\"1\"";

    /// <summary>The jobs that talk to Google: they push the image or deploy it. Nothing else gets an OIDC token.</summary>
    private static readonly HashSet<string> FederatedJobs = new(["build", "deploy-test", "deploy-production"], StringComparer.Ordinal);

    private static readonly HashSet<string> RootUsers = new(["", "0", "root"], StringComparer.Ordinal);

    private static readonly Dictionary<string, string> DeployEnvironments = new(StringComparer.Ordinal)
    {
        ["deploy-test"] = "name: test",
        ["deploy-production"] = "name: production",
    };

    /// <summary>Error details echo the data of a query; a password belongs in Secret Manager.</summary>
    private static readonly string[] ForbiddenSettings = ["Include Error Detail", "Password="];

    private static readonly string[] RequiredWorkflowFragments =
    [
        "workflow_run:",
        "workflows: [CI]",
        "github.event.workflow_run.conclusion == 'success'",
        "github.event.workflow_run.event == 'push'",
        "github.event.workflow_run.head_branch == 'main'",
        "needs: [build, deploy-test]",
        "cancel-in-progress: false",
    ];

    private static readonly string[] ForbiddenWorkflowFragments =
    [
        "pull_request",
        "workflow_dispatch",
        "secrets.",
        "continue-on-error",
        "|| true",
        "if: false",
        "outputs.api ==",
        DatabaseUrlVariable,
    ];

    internal static IReadOnlyList<string> DockerfileViolations(string dockerfile)
    {
        var lines = Instructions(dockerfile);
        var stages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var violations = new List<string>();
        foreach (var match in lines.Select(line => FromPattern().Match(line)).Where(match => match.Success))
        {
            var image = match.Groups["image"].Value;
            if (!stages.Contains(image) && !PinnedImagePattern().IsMatch(image))
            {
                violations.Add($"Dockerfile image not pinned by digest: {image}");
            }

            if (match.Groups["stage"].Success)
            {
                stages.Add(match.Groups["stage"].Value);
            }
        }

        var lastUser = lines.Select(line => UserPattern().Match(line)).LastOrDefault(match => match.Success);
        var user = lastUser?.Groups["user"].Value.Split(':')[0] ?? string.Empty;
        if (RootUsers.Contains(user))
        {
            violations.Add($"Dockerfile must end on a non-root USER, found [{user}]");
        }

        return violations;
    }

    /// <summary>Closed by default, and the .env files closed again after the last opening.</summary>
    internal static IReadOnlyList<string> DockerIgnoreViolations(string dockerIgnore)
    {
        var lines = Instructions(dockerIgnore);
        var lastReopen = lines.FindLastIndex(line => line.StartsWith(IgnoreReopen, StringComparison.Ordinal));
        return
        [
            .. lines.FirstOrDefault() == AllFiles ? Array.Empty<string>() : [$".dockerignore must start with {AllFiles}"],
            .. lines.LastIndexOf(EnvFiles) > lastReopen ? Array.Empty<string>() : [$".dockerignore must close {EnvFiles} after the last opening"],
        ];
    }

    internal static IReadOnlyList<string> WorkflowViolations(string workflow)
    {
        var code = string.Join('\n', Instructions(workflow));
        var jobsStart = JobsPattern().Match(code);
        var header = jobsStart.Success ? code[..jobsStart.Index] : code;
        var jobs = jobsStart.Success ? Jobs(code[jobsStart.Index..]) : [];
        return
        [
            .. RequiredWorkflowFragments
                .Where(fragment => !code.Contains(fragment, StringComparison.Ordinal))
                .Select(fragment => $"deploy-api.yml lacks: {fragment}"),
            .. ForbiddenWorkflowFragments
                .Where(fragment => code.Contains(fragment, StringComparison.Ordinal))
                .Select(fragment => $"deploy-api.yml contains: {fragment}"),
            .. header.Contains("id-token", StringComparison.Ordinal) ? ["deploy-api.yml grants id-token outside a job"] : Array.Empty<string>(),
            .. jobs
                .Where(job => job.Value.Contains(IdTokenWrite, StringComparison.Ordinal) && !FederatedJobs.Contains(job.Key))
                .Select(job => $"deploy-api.yml grants {IdTokenWrite} to {job.Key}"),
            .. DeployEnvironments
                .Where(deploy => !jobs.TryGetValue(deploy.Key, out var body)
                    || !body.Contains(deploy.Value, StringComparison.Ordinal)
                    || !body.Contains(ImageFromBuild, StringComparison.Ordinal))
                .Select(deploy => $"deploy-api.yml: {deploy.Key} needs {deploy.Value} and the image digest from build"),
            .. UnpinnedActions(code),
        ];
    }

    /// <summary>The composite action pins its actions and refuses an image that is not a digest of the sacou repository.</summary>
    internal static IReadOnlyList<string> ActionViolations(string action)
    {
        var code = string.Join('\n', Instructions(action));
        return
        [
            .. UnpinnedActions(code),
            .. code.Contains(@"/sacou/api@sha256:[0-9a-f]{64}$", StringComparison.Ordinal) ? Array.Empty<string>() : ["The deploy action must refuse an image without a digest"],
            .. code.Contains(DatabaseUrlVariable, StringComparison.Ordinal) ? ["The deploy action must not name the database URL"] : Array.Empty<string>(),
        ];
    }

    internal static IReadOnlyList<string> ServiceViolations(string service, string healthPath)
    {
        var code = string.Join('\n', Instructions(service));
        var maxScales = MaxScalePattern().Matches(code).Select(match => match.Groups["value"].Value).ToList();
        var probePath = StartupProbePathPattern().Match(code);
        return
        [
            .. maxScales.Count == 1 && maxScales[0] == OneInstance ? Array.Empty<string>() : [$"{MaxScaleKey} must be {OneInstance} once, found [{string.Join(", ", maxScales)}]"],
            .. probePath.Success && probePath.Groups["path"].Value == healthPath ? Array.Empty<string>() : [$"The startup probe must call {healthPath}"],
            .. SecretReferencePattern().IsMatch(code) ? Array.Empty<string>() : [$"{DatabaseUrlVariable} must come from secretKeyRef"],
            .. PlainDatabaseUrlPattern().IsMatch(code) ? [$"{DatabaseUrlVariable} must never have a plain value"] : Array.Empty<string>(),
            .. code.Contains("run.googleapis.com/cpu-throttling: \"true\"", StringComparison.Ordinal) ? Array.Empty<string>() : ["The service must bill by request (cpu-throttling)"],
        ];
    }

    internal static IReadOnlyList<string> AppSettingsViolations(string fileName, string json) =>
        [.. ForbiddenSettings
            .Where(fragment => json.Contains(fragment, StringComparison.OrdinalIgnoreCase))
            .Select(fragment => $"{fileName} contains {fragment}")];

    /// <summary>Request-based billing freezes the CPU outside requests: no background work runs (ADR 0068, D2).</summary>
    internal static IReadOnlyList<string> HostedServiceViolations(IEnumerable<Type> types) =>
        [.. types.Where(type => typeof(IHostedService).IsAssignableFrom(type)).Select(type => type.FullName ?? type.Name)];

    internal static IReadOnlyList<string> HostedServiceSourceViolations(IEnumerable<(string Path, string Source)> sources) =>
        [.. sources.Where(file => HostedServiceCallPattern().IsMatch(file.Source)).Select(file => $"{file.Path} registers a hosted service")];

    internal static string HealthPath(string program)
    {
        var match = HealthPathPattern().Match(program);
        return match.Success ? match.Groups["path"].Value : string.Empty;
    }

    private static IEnumerable<string> UnpinnedActions(string code) =>
        UsesPattern().Matches(code)
            .Select(match => match.Groups["action"].Value)
            .Where(action => !action.StartsWith(LocalActionPrefix, StringComparison.Ordinal) && !PinnedActionPattern().IsMatch(action))
            .Select(action => $"Action not pinned by SHA: {action}");

    /// <summary>Job name to its lines, for jobs at the two-space indentation under <c>jobs:</c>.</summary>
    private static Dictionary<string, string> Jobs(string jobs)
    {
        var starts = JobNamePattern().Matches(jobs).ToList();
        return starts
            .Select((match, index) => (Name: match.Groups["name"].Value,
                Body: jobs[match.Index..(index + 1 < starts.Count ? starts[index + 1].Index : jobs.Length)]))
            .GroupBy(job => job.Name, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => string.Join('\n', group.Select(job => job.Body)), StringComparer.Ordinal);
    }

    /// <summary>The lines without comments, trailing comments included, and without blank lines.</summary>
    private static List<string> Instructions(string text) =>
        [.. text.ReplaceLineEndings("\n").Split('\n')
            .Select(line => TrailingCommentPattern().Replace(line, string.Empty).TrimEnd())
            .Where(line => line.Trim().Length > 0)];

    [GeneratedRegex(@"^\s*FROM\s+(?:--platform=\S+\s+)?(?<image>\S+)(?:\s+AS\s+(?<stage>\S+))?\s*$", RegexOptions.IgnoreCase)]
    private static partial Regex FromPattern();

    [GeneratedRegex(@"^[^\s@]+:[^\s@]+@sha256:[0-9a-f]{64}$")]
    private static partial Regex PinnedImagePattern();

    [GeneratedRegex(@"^\s*USER\s+(?<user>\S+)\s*$", RegexOptions.IgnoreCase)]
    private static partial Regex UserPattern();

    [GeneratedRegex(@"^jobs:\s*$", RegexOptions.Multiline)]
    private static partial Regex JobsPattern();

    [GeneratedRegex(@"^  (?<name>[A-Za-z0-9_-]+):\s*$", RegexOptions.Multiline)]
    private static partial Regex JobNamePattern();

    [GeneratedRegex(@"^\s*(?:-\s+)?uses:\s*(?<action>\S+)", RegexOptions.Multiline)]
    private static partial Regex UsesPattern();

    [GeneratedRegex(@"^[\w.-]+/[\w./-]+@[0-9a-f]{40}$")]
    private static partial Regex PinnedActionPattern();

    [GeneratedRegex(@"autoscaling\.knative\.dev/maxScale:\s*(?<value>\S+)")]
    private static partial Regex MaxScalePattern();

    [GeneratedRegex(@"startupProbe:\s*\n\s+httpGet:\s*\n\s+path:\s*(?<path>\S+)")]
    private static partial Regex StartupProbePathPattern();

    [GeneratedRegex(@"-\s+name:\s*SACOU_DATABASE_URL\s*\n\s+valueFrom:\s*\n\s+secretKeyRef:\s*\n")]
    private static partial Regex SecretReferencePattern();

    [GeneratedRegex(@"SACOU_DATABASE_URL\s*\n\s+value:|SACOU_DATABASE_URL\s*[=:]\s*\S")]
    private static partial Regex PlainDatabaseUrlPattern();

    [GeneratedRegex(@"\bAddHostedService\b|\bIHostedService\b|\bBackgroundService\b")]
    private static partial Regex HostedServiceCallPattern();

    [GeneratedRegex(@"MapHealthChecks\(\s*""(?<path>[^""]+)""")]
    private static partial Regex HealthPathPattern();

    /// <summary>A # that starts the line or follows a space; a # inside a word (a URL fragment) stays.</summary>
    [GeneratedRegex(@"(^|\s)#.*$")]
    private static partial Regex TrailingCommentPattern();
}
