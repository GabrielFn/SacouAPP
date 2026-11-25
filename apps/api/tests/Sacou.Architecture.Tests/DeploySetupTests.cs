using System.Reflection;
using Microsoft.Extensions.Hosting;
using Xunit;

namespace Sacou.Architecture.Tests;

/// <summary>The deploy rules on the real files, then on planted violations (an untested rule proves nothing).</summary>
public sealed class DeploySetupTests
{
    private const string Digest = "@sha256:f2557fb81b1cfcfdfcde9d3bf247ed60b2cd38f00a88153f61e34737fab8ade7";
    private const string Sha = "7c6bc770dae815cd3e89ee6cdf493a5fab2cc093";
    private const string HealthPath = "/health";

    private static readonly string ValidDockerfile = $"""
        FROM mcr.microsoft.com/dotnet/sdk:10.0.403-noble{Digest} AS build
        RUN dotnet publish
        FROM mcr.microsoft.com/dotnet/aspnet:10.0.14-noble-chiseled{Digest} AS runtime
        COPY --from=build /app ./
        USER $APP_UID
        """;

    private static readonly string ValidDockerIgnore = """
        *
        !apps/api/src/
        **/bin/
        **/.env*
        """;

    private static readonly string ValidWorkflow = $$$"""
        on:
          workflow_run:
            workflows: [CI]
        permissions:
          contents: read
        jobs:
          changes:
            if: github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push' && github.event.workflow_run.head_branch == 'main'
            steps:
              - uses: actions/checkout@{{{Sha}}} # v7
          build:
            permissions:
              id-token: write
            steps:
              - with:
                  service_account: ${{ vars.GCP_BUILDER_SA }}
          deploy-test:
            concurrency:
              group: deploy-api-test
              cancel-in-progress: false
            environment:
              name: test
            permissions:
              id-token: write
            steps:
              - uses: ./.github/actions/deploy-cloud-run
                with:
                  image: ${{ needs.build.outputs.image }}
                  deployer: ${{ vars.GCP_DEPLOYER_TEST_SA }}
          deploy-production:
            needs: [build, deploy-test]
            concurrency:
              group: deploy-api-production
              cancel-in-progress: false
            environment:
              name: production
            permissions:
              id-token: write
            steps:
              - uses: ./.github/actions/deploy-cloud-run
                with:
                  image: ${{ needs.build.outputs.image }}
                  deployer: ${{ vars.GCP_DEPLOYER_PROD_SA }}
        """;

    private static readonly string ValidAction = $$"""
        runs:
          steps:
            - uses: google-github-actions/auth@{{Sha}} # v3.0.0
            - run: |
                [[ "$IMAGE" =~ ^us-east4-docker\.pkg\.dev/[a-z0-9-]+/sacou/api@sha256:[0-9a-f]{64}$ ]]
        """;

    private static readonly string ValidService = """
        metadata:
          annotations:
            autoscaling.knative.dev/maxScale: "1"
            run.googleapis.com/cpu-throttling: "true"
        env:
          - name: SACOU_DATABASE_URL
            valueFrom:
              secretKeyRef:
                name: ${DATABASE_SECRET}
          - name: SACOU_EXPO_ACCESS_TOKEN
            valueFrom:
              secretKeyRef:
                name: ${EXPO_SECRET}
          - name: SACOU_SENTRY_DSN
            valueFrom:
              secretKeyRef:
                name: ${SENTRY_SECRET}
        startupProbe:
          httpGet:
            path: /health
        """;

    [Fact]
    public void Dockerfile_PinsItsImagesAndRunsWithoutRoot()
    {
        ViolationAssert.None(DeploySetupRules.DockerfileViolations(RepositoryFiles.ReadRepositoryFile("Dockerfile")));
    }

    [Fact]
    public void DockerIgnore_ClosesTheContextAndTheEnvFiles()
    {
        ViolationAssert.None(DeploySetupRules.DockerIgnoreViolations(RepositoryFiles.ReadRepositoryFile(".dockerignore")));
    }

    [Fact]
    public void Workflow_DeploysAfterCiWithFederationOnlyWhereNeeded()
    {
        ViolationAssert.None(DeploySetupRules.WorkflowViolations(RepositoryFiles.ReadRepositoryFile(DeploySetupRules.WorkflowPath)));
    }

    [Fact]
    public void DeployAction_PinsItsActionsAndTakesADigest()
    {
        ViolationAssert.None(DeploySetupRules.ActionViolations(RepositoryFiles.ReadRepositoryFile(DeploySetupRules.ActionPath)));
    }

    [Fact]
    public void Service_HasOneInstanceTheHealthProbeAndTheSecret()
    {
        var program = RepositoryFiles.ReadRepositoryFile("apps", "api", "src", "Sacou.Api", "Program.cs");

        Assert.Equal(HealthPath, DeploySetupRules.HealthPath(program));
        ViolationAssert.None(DeploySetupRules.ServiceViolations(
            RepositoryFiles.ReadRepositoryFile(DeploySetupRules.ServicePath), DeploySetupRules.HealthPath(program)));
    }

    [Fact]
    public void AppSettings_HoldNoErrorDetailNorPassword()
    {
        var files = Directory.GetFiles(Path.Combine(RepositoryFiles.ApiDirectory, "src"), "appsettings*.json", SearchOption.AllDirectories)
            .Where(path => !path.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}", StringComparison.Ordinal)
                && !path.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}", StringComparison.Ordinal))
            .ToList();

        Assert.NotEmpty(files);
        ViolationAssert.None(files.SelectMany(path => DeploySetupRules.AppSettingsViolations(Path.GetFileName(path), File.ReadAllText(path))));
    }

    [Fact]
    public void Api_HasNoBackgroundWork()
    {
        var api = Assembly.Load("Sacou.Api");
        var types = Assemblies.ModulesAndShared.Value.Append(api).SelectMany(assembly => assembly.GetTypes());
        var sources = Directory.GetFiles(Path.Combine(RepositoryFiles.ApiDirectory, "src"), "*.cs", SearchOption.AllDirectories)
            .Select(path => (path, File.ReadAllText(path)));

        ViolationAssert.None(DeploySetupRules.HostedServiceViolations(types));
        ViolationAssert.None(DeploySetupRules.HostedServiceSourceViolations(sources));
    }

    [Fact]
    public void ValidPlantedFiles_PassEveryRule()
    {
        ViolationAssert.None(DeploySetupRules.DockerfileViolations(ValidDockerfile));
        ViolationAssert.None(DeploySetupRules.DockerIgnoreViolations(ValidDockerIgnore));
        ViolationAssert.None(DeploySetupRules.WorkflowViolations(ValidWorkflow));
        ViolationAssert.None(DeploySetupRules.ActionViolations(ValidAction));
        ViolationAssert.None(DeploySetupRules.ServiceViolations(ValidService, HealthPath));
    }

    [Theory]
    [InlineData(Digest, "")]
    [InlineData("USER $APP_UID", "USER root")]
    [InlineData("USER $APP_UID", "USER 0")]
    [InlineData("USER $APP_UID", "USER 0:0")]
    [InlineData("USER $APP_UID", "# USER 1654")]
    public void Dockerfile_Violations(string valid, string planted)
    {
        Assert.NotEmpty(DeploySetupRules.DockerfileViolations(ValidDockerfile.Replace(valid, planted, StringComparison.Ordinal)));
    }

    [Theory]
    [InlineData("**/.env*", "")]
    [InlineData("**/.env*", "# **/.env*")]
    [InlineData("*\n!apps", "!apps")]
    public void DockerIgnore_Violations(string valid, string planted)
    {
        Assert.NotEmpty(DeploySetupRules.DockerIgnoreViolations(ValidDockerIgnore.ReplaceLineEndings("\n").Replace(valid, planted, StringComparison.Ordinal)));
    }

    [Fact]
    public void DockerIgnore_EnvOnlyBeforeAnOpening_IsAViolation()
    {
        Assert.NotEmpty(DeploySetupRules.DockerIgnoreViolations("*\n**/.env*\n!apps/api/src/\n"));
    }

    [Theory]
    [InlineData("permissions:\n  contents: read", "permissions:\n  contents: read\n  id-token: write")]
    [InlineData("  changes:\n    if:", "  changes:\n    permissions:\n      id-token: write\n    if:")]
    [InlineData("actions/checkout@" + Sha, "actions/checkout@v7")]
    [InlineData("name: production", "name: test")]
    [InlineData("conclusion == 'success'", "conclusion != 'cancelled'")]
    [InlineData("workflow_run:", "pull_request:\n  workflow_run:")]
    [InlineData("    needs: [build, deploy-test]", "    needs: build")]
    [InlineData("cancel-in-progress: false\n    environment:\n      name: test", "cancel-in-progress: true\n    environment:\n      name: test")]
    [InlineData("      group: deploy-api-production\n      cancel-in-progress: false\n", "")]
    [InlineData("contents: read\njobs:", "contents: read\nconcurrency:\n  group: deploy-api\njobs:")]
    [InlineData("image: ${{ needs.build.outputs.image }}\n          deployer: ${{ vars.GCP_DEPLOYER_TEST_SA }}", "image: us-east4-docker.pkg.dev/p/sacou/api:latest\n          deployer: ${{ vars.GCP_DEPLOYER_TEST_SA }}")]
    [InlineData("contents: read\njobs:", "contents: read\nenv:\n  SACOU_DATABASE_URL: x\njobs:")]
    [InlineData("contents: read\njobs:", "contents: read\nenv:\n  TOKEN: ${{ secrets.TOKEN }}\njobs:")]
    [InlineData("vars.GCP_BUILDER_SA", "vars.GCP_DEPLOYER_PROD_SA")]
    [InlineData("vars.GCP_DEPLOYER_TEST_SA", "vars.GCP_DEPLOYER_PROD_SA")]
    [InlineData("vars.GCP_DEPLOYER_PROD_SA", "vars.GCP_DEPLOYER_TEST_SA")]
    [InlineData("vars.GCP_DEPLOYER_PROD_SA", "vars.GCP_DEPLOYER_SA")]
    [InlineData("    permissions:\n      id-token: write\n    steps:\n      - with:", "    environment: production\n    permissions:\n      id-token: write\n    steps:\n      - with:")]
    public void Workflow_Violations(string valid, string planted)
    {
        var workflow = ValidWorkflow.ReplaceLineEndings("\n");
        Assert.Contains(valid, workflow, StringComparison.Ordinal);

        Assert.NotEmpty(DeploySetupRules.WorkflowViolations(workflow.Replace(valid, planted, StringComparison.Ordinal)));
    }

    [Theory]
    [InlineData("google-github-actions/auth@" + Sha, "google-github-actions/auth@v3")]
    [InlineData("/sacou/api@sha256:[0-9a-f]{64}$", "/sacou/api[:@].*$")]
    [InlineData("[[ \"$IMAGE\"", "echo \"$SACOU_DATABASE_URL\"; [[ \"$IMAGE\"")]
    [InlineData("[[ \"$IMAGE\"", "echo \"$SACOU_EXPO_ACCESS_TOKEN\"; [[ \"$IMAGE\"")]
    [InlineData("[[ \"$IMAGE\"", "echo \"$SACOU_SENTRY_DSN\"; [[ \"$IMAGE\"")]
    public void Action_Violations(string valid, string planted)
    {
        Assert.Contains(valid, ValidAction, StringComparison.Ordinal);
        Assert.NotEmpty(DeploySetupRules.ActionViolations(ValidAction.Replace(valid, planted, StringComparison.Ordinal)));
    }

    [Theory]
    [InlineData("maxScale: \"1\"", "maxScale: \"2\"")]
    [InlineData("maxScale: \"1\"", "minScale: \"0\"")]
    [InlineData("maxScale: \"1\"", "maxScale: \"1\"\n    autoscaling.knative.dev/maxScale: \"100\"")]
    [InlineData("path: /health", "path: /healthz")]
    [InlineData("valueFrom:\n      secretKeyRef:\n        name: ${DATABASE_SECRET}", "value: postgresql://u:p@h/db")]
    [InlineData("cpu-throttling: \"true\"", "cpu-throttling: \"false\"")]
    [InlineData("valueFrom:\n      secretKeyRef:\n        name: ${EXPO_SECRET}", "value: planted-expo-token")]
    [InlineData("valueFrom:\n      secretKeyRef:\n        name: ${SENTRY_SECRET}", "value: https://planted@sentry.invalid/1")]
    public void Service_Violations(string valid, string planted)
    {
        var service = ValidService.ReplaceLineEndings("\n");
        Assert.Contains(valid, service, StringComparison.Ordinal);

        Assert.NotEmpty(DeploySetupRules.ServiceViolations(service.Replace(valid, planted, StringComparison.Ordinal), HealthPath));
    }

    [Theory]
    [InlineData("""{ "ConnectionStrings": { "Sacou": "Host=h;Include Error Detail=true" } }""")]
    [InlineData("""{ "ConnectionStrings": { "Sacou": "Host=h;password=x" } }""")]
    public void AppSettings_Violations(string json)
    {
        Assert.NotEmpty(DeploySetupRules.AppSettingsViolations("appsettings.Production.json", json));
    }

    [Fact]
    public void PlantedHostedService_IsAViolation()
    {
        Assert.Equal([typeof(PlantedWorker).FullName!], DeploySetupRules.HostedServiceViolations([typeof(PlantedWorker), typeof(DeploySetupTests)]));
    }

    [Theory]
    [InlineData("builder.Services.AddHostedService<Worker>();")]
    [InlineData("internal sealed class Worker : BackgroundService { }")]
    [InlineData("services.AddSingleton<IHostedService, Worker>();")]
    public void PlantedHostedServiceSource_IsAViolation(string source)
    {
        Assert.NotEmpty(DeploySetupRules.HostedServiceSourceViolations([("Planted.cs", source)]));
    }

    private sealed class PlantedWorker : BackgroundService
    {
        protected override Task ExecuteAsync(CancellationToken stoppingToken) => Task.CompletedTask;
    }
}
